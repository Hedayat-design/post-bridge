import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const supabase = supabaseServer()
  // getUser() validates the JWT against the auth server; getSession() trusts
  // whatever is in the cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { caption, mediaUrls, mediaType, scheduledFor, socialAccountIds } = body as {
    caption: string
    mediaUrls: string[]
    mediaType: 'image' | 'video' | 'carousel' | 'text'
    scheduledFor: string | null   // absolute ISO-8601 with offset, or null to post now
    socialAccountIds: string[]     // which connected accounts to publish to
  }

  if (!socialAccountIds?.length) {
    return NextResponse.json({ error: 'Select at least one connected account' }, { status: 400 })
  }
  if (!caption?.trim() && !mediaUrls?.length) {
    return NextResponse.json({ error: 'Add a caption or some media' }, { status: 400 })
  }

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
    .select('id')
    .eq('user_id', user.id)
    .in('id', socialAccountIds)

  if ((ownedAccounts?.length ?? 0) !== socialAccountIds.length) {
    return NextResponse.json({ error: 'Unknown connected account' }, { status: 400 })
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
