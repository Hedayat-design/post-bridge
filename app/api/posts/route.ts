import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { caption, mediaUrls, mediaType, scheduledFor, socialAccountIds } = body as {
    caption: string
    mediaUrls: string[]
    mediaType: 'image' | 'video' | 'carousel'
    scheduledFor: string | null   // ISO string, or null to post immediately
    socialAccountIds: string[]     // which connected accounts to publish to
  }

  if (!socialAccountIds?.length) {
    return NextResponse.json({ error: 'Select at least one connected account' }, { status: 400 })
  }

  // Enforce free-plan post cap (5 total posts)
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', session.user.id).single()
  if ((profile?.plan ?? 'free') === 'free') {
    const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id)
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Free plan limit reached — upgrade to post more' }, { status: 402 })
    }
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      user_id: session.user.id,
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

  // If posting immediately (no schedule), kick off publishing right away.
  // The actual platform calls live in lib/adapters/*.ts and are triggered
  // from the same publisher used by the cron scheduler (see Part 5).
  if (!scheduledFor) {
    await fetch(`${request.nextUrl.origin}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id }),
    })
  }

  return NextResponse.json({ post })
}
