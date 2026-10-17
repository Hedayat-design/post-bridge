import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { actingMemberId, forbidUnless } from '@/lib/team/access'
import { effectiveTextLimit } from '@/lib/adapters/limits'
import { generateCaption, openRouterConfigured } from '@/lib/ai/openrouter'
import { monthStart, quotaMessage, quotaState } from '@/lib/ai/quota'
import { GenerationError, PlatformStyle } from '@/lib/ai/types'

// Several platforms, each a model call, run one after another.
export const maxDuration = 300

/**
 * Generates one caption per selected account.
 *
 * Runs as the signed-in user, so row-level security scopes the styles and the
 * generation log without this route filtering by hand. The OpenRouter key
 * never leaves the server: the browser asks this route, not OpenRouter.
 */
export async function POST(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const refused = await forbidUnless('post')
  if (refused) return refused
  const createdBy = await actingMemberId()

  if (!openRouterConfigured()) {
    return NextResponse.json(
      { error: 'Caption generation is not configured on this deployment.' },
      { status: 503 }
    )
  }

  const { socialAccountIds, imageUrls, brief } = (await request.json()) as {
    socialAccountIds: string[]
    imageUrls: string[]
    brief?: string
  }

  if (!socialAccountIds?.length) {
    return NextResponse.json({ error: 'Select at least one account first' }, { status: 400 })
  }
  // Vision is the whole point: without an image there is nothing to write about.
  if (!imageUrls?.length) {
    return NextResponse.json({ error: 'Upload an image before generating captions' }, { status: 400 })
  }

  // The accounts must be the caller's. RLS would catch it, but a clear error
  // beats an empty result.
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id, platform, display_name, has_x_premium')
    .eq('user_id', user.id)
    .in('id', socialAccountIds)

  if ((accounts?.length ?? 0) !== socialAccountIds.length) {
    return NextResponse.json({ error: 'Unknown connected account' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single()
  const plan = profile?.plan ?? 'free'

  const { count: usedThisMonth } = await supabase
    .from('caption_generations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', monthStart().toISOString())

  let quota = quotaState(usedThisMonth ?? 0, plan)
  if (quota.exceeded) {
    return NextResponse.json({ error: quotaMessage(quota, plan) }, { status: 402 })
  }

  const { data: styleRows } = await supabase
    .from('platform_styles')
    .select('platform, instructions, examples, model, enabled')
    .eq('user_id', user.id)

  const styles = new Map((styleRows ?? []).map((row) => [row.platform, row as PlatformStyle]))

  const captions: Array<{ accountId: string; platform: string; text: string }> = []
  const failures: Array<{ accountId: string; platform: string; error: string }> = []

  for (const account of accounts ?? []) {
    // Stop at the ceiling rather than overshooting it: each loop iteration is
    // another paid call, and the count only moves while we are in here.
    if (quota.exceeded) {
      failures.push({
        accountId: account.id,
        platform: account.platform,
        error: quotaMessage(quota, plan),
      })
      continue
    }

    const stored = styles.get(account.platform)

    // A platform switched off in the dashboard is skipped quietly rather than
    // reported as a failure — the user already said they don't want it.
    if (stored && !stored.enabled) continue

    const style: PlatformStyle = stored ?? {
      platform: account.platform,
      instructions: '',
      examples: [],
      model: '',
      enabled: true,
    }

    const characterLimit = effectiveTextLimit(account.platform, {
      hasXPremium: account.has_x_premium ?? false,
    })

    try {
      const generated = await generateCaption({ style, characterLimit, imageUrls, brief })

      await supabase.from('caption_generations').insert({
        user_id: user.id,
        created_by: createdBy,
        platform: account.platform,
        model: generated.model,
        prompt_tokens: generated.promptTokens ?? null,
        completion_tokens: generated.completionTokens ?? null,
        succeeded: true,
      })

      captions.push({
        accountId: account.id,
        platform: account.platform,
        text: generated.text,
      })
    } catch (e) {
      const message =
        e instanceof GenerationError ? e.message : (e as Error).message

      // Logged as a row because a failed call still costs tokens upstream;
      // excluding it would make a broken model slug a free unlimited loop.
      await supabase.from('caption_generations').insert({
        user_id: user.id,
        created_by: createdBy,
        platform: account.platform,
        model: style.model || 'default',
        succeeded: false,
        error_message: message,
      })

      failures.push({ accountId: account.id, platform: account.platform, error: message })
    }

    quota = quotaState(quota.used + 1, plan)
  }

  // Partial success is normal here — one platform's model can be misconfigured
  // while the rest are fine, and throwing away the good captions to report a
  // single failure would waste what the user already paid for.
  return NextResponse.json({
    captions,
    failures,
    quota: {
      used: quota.used,
      limit: quota.limit === Infinity ? null : quota.limit,
      remaining: quota.remaining === Infinity ? null : quota.remaining,
    },
  })
}
