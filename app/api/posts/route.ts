import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { LIMITS, sanitizePlatformOptions, validateXReplies } from '@/lib/adapters/limits'
import {
  preflightResolvedTarget,
  resolveTargetContent,
  sanitizeConfigurations,
  validateConfigurationTargets,
} from '@/lib/adapters/overrides'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const supabase = supabaseServer()
  // getUser() validates the JWT against the auth server; getSession() trusts
  // whatever is in the cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const {
    caption,
    mediaUrls,
    mediaType,
    scheduledFor,
    socialAccountIds,
    platformConfigurations,
    accountConfigurations,
    platformOptions,
  } = body as {
    caption: string
    mediaUrls: string[]
    mediaType: 'image' | 'video' | 'carousel' | 'text'
    scheduledFor: string | null   // absolute ISO-8601 with offset, or null to post now
    socialAccountIds: string[]     // which connected accounts to publish to
    // Caption/media overrides keyed by platform and by account id. See
    // lib/adapters/overrides.ts for the resolution order.
    platformConfigurations?: unknown
    accountConfigurations?: unknown
    // Settings passed through to the platform rather than resolved away:
    // X first comment and thread, TikTok/YouTube disclosures. See
    // PlatformOptions in lib/adapters/limits.ts.
    platformOptions?: unknown
  }

  if (!socialAccountIds?.length) {
    return NextResponse.json({ error: 'Select at least one connected account' }, { status: 400 })
  }

  // Store only well-formed overrides: this lands in a jsonb column that the
  // publish route reads back, and resolution is not the place to discover that
  // a caption is a number.
  const platformConfigs = sanitizeConfigurations(platformConfigurations)
  const accountConfigs = sanitizeConfigurations(accountConfigurations)

  // These reach the platform verbatim at publish time, so a wrong type here
  // is a wrong type on someone's timeline. Drop anything malformed before it
  // reaches the column.
  const options = sanitizePlatformOptions(platformOptions)

  // There is deliberately no "caption or media required" check here: with
  // per-platform captions an empty default is legitimate, as long as every
  // target resolves to something. That is checked per target below.

  // Reject a naive datetime outright rather than silently storing it as UTC
  // and firing the post hours away from when the user meant.
  if (scheduledFor) {
    const parsed = Date.parse(scheduledFor)
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: 'Invalid schedule time' }, { status: 400 })
    }
    if (parsed < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Schedule time is in the past' }, { status: 400 })
    }
  }

  // The selected accounts must actually belong to the caller. RLS would catch
  // this on insert, but failing early gives a clearer error.
  const { data: ownedAccounts } = await supabase
    .from('social_accounts')
    .select('id, platform, display_name, has_x_premium')
    .eq('user_id', user.id)
    .in('id', socialAccountIds)

  if ((ownedAccounts?.length ?? 0) !== socialAccountIds.length) {
    return NextResponse.json({ error: 'Unknown connected account' }, { status: 400 })
  }

  const accounts = ownedAccounts ?? []

  const strayOverride = validateConfigurationTargets({
    platformConfigurations: platformConfigs,
    accountConfigurations: accountConfigs,
    selectedPlatforms: accounts.map((a) => a.platform),
    selectedAccountIds: accounts.map((a) => a.id),
  })
  if (strayOverride) {
    return NextResponse.json({ error: strayOverride }, { status: 400 })
  }

  // Same reasoning as a stray caption override: a first comment written for an
  // X account that is no longer selected would silently never be posted, and
  // the user would be left wondering why their link never appeared.
  if (options.x && !accounts.some((a) => a.platform === 'x')) {
    return NextResponse.json(
      { error: 'Wrote an X first comment or thread, but no X account is selected' },
      { status: 400 }
    )
  }

  // Check what each target will actually publish, not the post's default
  // caption. A per-platform caption that is too long for its platform should
  // fail here, while the user can still fix it — not at publish time, which for
  // a scheduled post is hours later with nobody watching.
  for (const account of accounts) {
    const content = resolveTargetContent({
      platform: account.platform,
      accountId: account.id,
      caption: caption ?? '',
      mediaUrls: mediaUrls ?? [],
      platformConfigurations: platformConfigs,
      accountConfigurations: accountConfigs,
    })

    const capabilities = { hasXPremium: account.has_x_premium ?? false }

    const invalid =
      preflightResolvedTarget({
        platform: account.platform,
        caption: content.caption,
        mediaCount: content.mediaUrls.length,
        capabilities,
      }) ??
      // Every reply is a tweet, measured against this account's own ceiling.
      // Catching an over-long one here means the user fixes it in the
      // composer; catching it at publish time means the main tweet is already
      // live and unsendable with its reply missing.
      (account.platform === 'x' && options.x ? validateXReplies(options.x, capabilities) : null)

    if (invalid) {
      const label = LIMITS[account.platform]?.label ?? account.platform
      const named = account.display_name ? `${label} · ${account.display_name}` : label
      return NextResponse.json({ error: `${named}: ${invalid}` }, { status: 400 })
    }
  }

  // Enforce free-plan post cap (5 total posts)
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  if ((profile?.plan ?? 'free') === 'free') {
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Free plan limit reached — upgrade to post more' }, { status: 402 })
    }
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      caption,
      media_urls: mediaUrls,
      media_type: mediaType,
      status: scheduledFor ? 'scheduled' : 'posting',
      scheduled_for: scheduledFor,
      platform_configurations: platformConfigs,
      account_configurations: accountConfigs,
      platform_options: options,
    })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  const targets = socialAccountIds.map((id) => ({ post_id: post.id, social_account_id: id }))
  const { error: targetsError } = await supabase.from('post_targets').insert(targets)
  if (targetsError) return NextResponse.json({ error: targetsError.message }, { status: 500 })

  // If posting immediately, publish inline so the caller gets the real result
  // instead of a success that may not have happened.
  if (!scheduledFor) {
    const res = await fetch(`${request.nextUrl.origin}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ postId: post.id }),
    })
    const outcome = await res.json().catch(() => ({}))

    if (outcome.posted === 0 && outcome.total > 0) {
      // Surface the per-platform reason rather than a generic failure.
      const { data: failures } = await supabase
        .from('post_targets')
        .select('error_message')
        .eq('post_id', post.id)
        .eq('status', 'failed')

      return NextResponse.json(
        { error: failures?.[0]?.error_message ?? 'Publishing failed', post },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({ post })
}
