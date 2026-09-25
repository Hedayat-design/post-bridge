import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adapters } from '@/lib/adapters'

// Publishes a single post to all of its target platforms.
// Called directly for "post now", and by the cron route for scheduled posts.
export async function POST(request: NextRequest) {
  const { postId } = await request.json()
  const admin = supabaseAdmin()

  const { data: post } = await admin.from('posts').select('*').eq('id', postId).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: targets } = await admin
    .from('post_targets')
    .select('*, social_accounts(*)')
    .eq('post_id', postId)

  let anyFailed = false

  for (const target of targets ?? []) {
    const account = target.social_accounts
    const adapter = adapters[account.platform]
    if (!adapter) continue

    const result = await adapter.publish({
      accessToken: account.access_token,
      caption: post.caption ?? '',
      mediaUrls: post.media_urls ?? [],
      mediaType: post.media_type ?? 'image',
    })

    await admin.from('post_targets').update({
      status: result.success ? 'posted' : 'failed',
      platform_post_id: result.platformPostId ?? null,
      error_message: result.errorMessage ?? null,
      posted_at: result.success ? new Date().toISOString() : null,
    }).eq('id', target.id)

    if (!result.success) anyFailed = true
  }

  await admin.from('posts').update({
    status: anyFailed ? 'failed' : 'posted',
  }).eq('id', postId)

  return NextResponse.json({ done: true })
}
