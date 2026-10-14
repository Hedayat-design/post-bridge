import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { adapters } from '@/lib/adapters'
import { ensureFreshToken, SocialAccountRow } from '@/lib/tokens'
import { downloadMedia } from '@/lib/media'
import { MediaItem, TokenExpiredError } from '@/lib/adapters/types'
import {
  mediaTypeFor,
  resolveTargetContent,
  validateResolvedTarget,
} from '@/lib/adapters/overrides'

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

  // Resolve each target's caption and media before anything else: a target can
  // override its media, so the download set is the union of what the targets
  // actually need rather than whatever the post carries as its default.
  const pending = (targets ?? []).map((target) => {
    const account = target.social_accounts as SocialAccountRow
    return {
      target,
      account,
      content: resolveTargetContent({
        platform: account.platform,
        accountId: account.id,
        caption: post.caption ?? '',
        mediaUrls: post.media_urls ?? [],
        platformConfigurations: post.platform_configurations,
        accountConfigurations: post.account_configurations,
      }),
    }
  })

  // Download each distinct URL once and share the bytes across every target
  // that uses it, rather than handing an adapter a URL it cannot fetch or
  // fetching the same file per platform.
  let mediaByUrl: Map<string, MediaItem>
  try {
    const urls = Array.from(new Set(pending.flatMap((p) => p.content.mediaUrls)))
    mediaByUrl = new Map((await downloadMedia(urls)).map((item) => [item.url, item]))
  } catch (e) {
    await admin
      .from('post_targets')
      .update({ status: 'failed', error_message: (e as Error).message })
      .eq('post_id', postId)
      .eq('status', 'pending')
    await admin.from('posts').update({ status: 'failed' }).eq('id', postId)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  for (const { target, account, content } of pending) {
    const adapter = adapters[account.platform]

    if (!adapter) {
      await admin
        .from('post_targets')
        .update({ status: 'failed', error_message: `No adapter for ${account.platform}` })
        .eq('id', target.id)
      continue
    }

    // Every resolved URL is in the map: the download above either produced all
    // of them or failed the whole post.
    const media = content.mediaUrls.map((url) => mediaByUrl.get(url)!)
    const capabilities = { hasXPremium: account.has_x_premium ?? false }
    const platformOptions = post.platform_options ?? {}

    // Check the caption this target actually publishes, which is not the post's
    // default once something overrides it. The adapters validate again — this
    // is to fail before spending a token refresh and a media upload, and to
    // give the stub platforms the same rejection the real ones would.
    const invalid = validateResolvedTarget({
      platform: account.platform,
      caption: content.caption,
      media,
      capabilities,
      options: platformOptions,
    })
    if (invalid) {
      await admin
        .from('post_targets')
        .update({ status: 'failed', error_message: invalid })
        .eq('id', target.id)
      continue
    }

    let result
    try {
      const accessToken = await ensureFreshToken(admin, account)
      result = await adapter.publish({
        accessToken,
        caption: content.caption,
        media,
        mediaType: mediaTypeFor(media),
        platformAccountId: account.platform_account_id,
        accountCapabilities: capabilities,
        platformOptions,
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

    // 'partial' is the post that went out with something missing underneath
    // it — an X first comment or thread entry that failed after the main
    // tweet was already live. It is deliberately not 'failed': the id is
    // real, the post is public, and a retry would double-post. It is not
    // plain 'posted' either, or the reply error would vanish.
    const partial = result.success && !!result.partialErrorMessage

    await admin
      .from('post_targets')
      .update({
        status: result.success ? (partial ? 'partial' : 'posted') : 'failed',
        platform_post_id: result.platformPostId ?? null,
        error_message: result.partialErrorMessage ?? result.errorMessage ?? null,
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

  // A partial target counts as delivered here: its post is live on the
  // platform, so calling the whole post failed would be a lie the user can
  // disprove by opening the tweet. The reply error stays on the target row.
  const delivered = (finalTargets ?? []).filter(
    (t) => t.status === 'posted' || t.status === 'partial'
  )
  const anyFailed = delivered.length < (finalTargets?.length ?? 0)
  await admin.from('posts').update({ status: anyFailed ? 'failed' : 'posted' }).eq('id', postId)

  return NextResponse.json({
    done: true,
    // `posted` is what /api/posts checks before reporting a flat failure to
    // the composer, so a partial has to count — otherwise a tweet that is
    // live with a failed reply would come back as "Publishing failed".
    posted: delivered.length,
    partial: delivered.filter((t) => t.status === 'partial').length,
    total: finalTargets?.length ?? 0,
  })
}
