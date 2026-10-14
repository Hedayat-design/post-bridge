import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { adapters } from '@/lib/adapters'
import { ensureFreshToken, SocialAccountRow } from '@/lib/tokens'
import { downloadMedia } from '@/lib/media'
import { TokenExpiredError } from '@/lib/adapters/types'

export const maxDuration = 300 // uploads are slow; don't get cut off mid-post

/**
 * Publishes a single post to all of its target platforms.
 * Called by /api/posts for "post now" and by /api/cron for scheduled posts.
 *
 * This endpoint runs with service-role credentials, so it is internal-only:
 * callers must present INTERNAL_API_SECRET. It previously had no auth at all,
 * meaning anyone who guessed a post id could trigger a real publish.
 */
function authorized(request: NextRequest): boolean {
  const provided = request.headers.get('x-internal-secret')
  const expected = process.env.INTERNAL_API_SECRET
  if (!provided || !expected) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { postId } = await request.json()
  const admin = supabaseAdmin()

  const { data: post } = await admin.from('posts').select('*').eq('id', postId).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: targets } = await admin
    .from('post_targets')
    .select('*, social_accounts(*)')
    .eq('post_id', postId)
    .eq('status', 'pending') // don't re-send targets that already succeeded

  // Download once and share the bytes across every platform, rather than
  // handing each adapter a URL it cannot fetch.
  let media
  try {
    media = await downloadMedia(post.media_urls ?? [])
  } catch (e) {
    await admin
      .from('post_targets')
      .update({ status: 'failed', error_message: (e as Error).message })
      .eq('post_id', postId)
      .eq('status', 'pending')
    await admin.from('posts').update({ status: 'failed' }).eq('id', postId)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  for (const target of targets ?? []) {
    const account = target.social_accounts as SocialAccountRow
    const adapter = adapters[account.platform]

    if (!adapter) {
      await admin
        .from('post_targets')
        .update({ status: 'failed', error_message: `No adapter for ${account.platform}` })
        .eq('id', target.id)
      continue
    }

    let result
    try {
      const accessToken = await ensureFreshToken(admin, account)
      result = await adapter.publish({
        accessToken,
        caption: post.caption ?? '',
        media,
        mediaType: post.media_type ?? (media.length ? 'image' : 'text'),
        platformAccountId: account.platform_account_id,
        accountCapabilities: { hasXPremium: account.has_x_premium ?? false },
        platformOptions: post.platform_options ?? {},
      })
    } catch (e) {
      // A dead token is worth flagging distinctly — the fix is reconnecting,
      // not retrying.
      result = {
        success: false,
        errorMessage:
          e instanceof TokenExpiredError
            ? `${account.platform}: ${e.message}`
            : (e as Error).message,
      }
    }

    await admin
      .from('post_targets')
      .update({
        status: result.success ? 'posted' : 'failed',
        platform_post_id: result.platformPostId ?? null,
        error_message: result.errorMessage ?? null,
        posted_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', target.id)
  }

  // Derive the post's status from all of its targets, including ones that
  // succeeded on an earlier attempt.
  const { data: finalTargets } = await admin
    .from('post_targets')
    .select('status')
    .eq('post_id', postId)

  const anyFailed = (finalTargets ?? []).some((t) => t.status !== 'posted')
  await admin.from('posts').update({ status: anyFailed ? 'failed' : 'posted' }).eq('id', postId)

  return NextResponse.json({
    done: true,
    posted: (finalTargets ?? []).filter((t) => t.status === 'posted').length,
    total: finalTargets?.length ?? 0,
  })
}
