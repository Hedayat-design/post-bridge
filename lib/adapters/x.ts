import {
  PlatformAdapter,
  PublishInput,
  PublishResult,
  PlatformProfile,
  RefreshedToken,
  MediaItem,
  TokenExpiredError,
} from './types'
import { validatePost } from './limits'
import { stripLinks } from './x-links'

// Docs:
//   Tweets  https://docs.x.com/x-api/posts/creation-of-a-post
//   Media   https://docs.x.com/x-api/media/quickstart/chunked-upload
//   OAuth   https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/user-access-token
const API = 'https://api.x.com/2'
const CHUNK_BYTES = 4 * 1024 * 1024 // X caps each APPEND at 5MB; stay under it

function mediaCategory(contentType: string): string {
  if (contentType === 'image/gif') return 'tweet_gif'
  if (contentType.startsWith('video/')) return 'tweet_video'
  return 'tweet_image'
}

async function xFetch(url: string, accessToken: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new TokenExpiredError('X rejected the access token')
  return res
}

/** INIT → APPEND(n) → FINALIZE → (STATUS poll for video). Returns the media id. */
async function uploadMedia(accessToken: string, item: MediaItem): Promise<string> {
  const category = mediaCategory(item.contentType)

  const initRes = await xFetch(`${API}/media/upload`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(item.bytes.byteLength),
      media_type: item.contentType,
      media_category: category,
    }),
  })

  const initData = await initRes.json().catch(() => ({}))
  const mediaId: string | undefined = initData?.data?.id ?? initData?.media_id_string
  if (!initRes.ok || !mediaId) {
    throw new Error(initData?.errors?.[0]?.message ?? initData?.error ?? 'X media INIT failed')
  }

  for (let offset = 0, segment = 0; offset < item.bytes.byteLength; offset += CHUNK_BYTES, segment++) {
    const chunk = item.bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, item.bytes.byteLength))

    const form = new FormData()
    form.set('command', 'APPEND')
    form.set('media_id', mediaId)
    form.set('segment_index', String(segment))
    form.set('media', new Blob([new Uint8Array(chunk)], { type: item.contentType }), item.filename)

    // Content-Type is intentionally unset — fetch adds the multipart boundary.
    const appendRes = await xFetch(`${API}/media/upload`, accessToken, { method: 'POST', body: form })
    if (!appendRes.ok) {
      const err = await appendRes.text().catch(() => '')
      throw new Error(`X media APPEND failed on segment ${segment}: ${err.slice(0, 200)}`)
    }
  }

  const finalizeRes = await xFetch(`${API}/media/upload`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
  })
  const finalizeData = await finalizeRes.json().catch(() => ({}))
  if (!finalizeRes.ok) {
    throw new Error(finalizeData?.errors?.[0]?.message ?? 'X media FINALIZE failed')
  }

  // Video and GIF are transcoded asynchronously; a tweet referencing an
  // unprocessed media id is rejected, so wait it out.
  let info = finalizeData?.data?.processing_info ?? finalizeData?.processing_info
  while (info && info.state !== 'succeeded') {
    // FINALIZE itself can come back already failed, so check before waiting.
    if (info.state === 'failed') {
      throw new Error(info.error?.message ?? 'X media processing failed')
    }

    await new Promise((r) => setTimeout(r, Math.max(1, info.check_after_secs ?? 1) * 1000))

    const statusRes = await xFetch(
      `${API}/media/upload?command=STATUS&media_id=${mediaId}`,
      accessToken,
      { method: 'GET' }
    )
    const statusData = await statusRes.json().catch(() => ({}))
    info = statusData?.data?.processing_info ?? statusData?.processing_info

    if (!info) break // no processing_info means nothing left to wait for
  }

  return mediaId
}

export const xAdapter: PlatformAdapter = {
  async fetchProfile(accessToken: string): Promise<PlatformProfile> {
    const BASE_FIELDS = 'profile_image_url,username,name'

    // subscription_type tells us whether the caption limit is 280 or 25,000.
    // It is requested separately from the fields we depend on: X returns 400
    // for an unrecognised user.field, and a rejected field must not be able
    // to break account connection. On any doubt we fall back to the base
    // request and treat the account as non-Premium, which is the stricter
    // limit — X itself rejects an over-long post, so we fail safe either way.
    let res = await xFetch(
      `${API}/users/me?user.fields=${BASE_FIELDS},subscription_type`,
      accessToken
    )
    let data = await res.json().catch(() => ({}))

    if (!res.ok || !data?.data?.id) {
      res = await xFetch(`${API}/users/me?user.fields=${BASE_FIELDS}`, accessToken)
      data = await res.json().catch(() => ({}))
    }
    if (!res.ok || !data?.data?.id) {
      throw new Error(data?.detail ?? data?.title ?? 'Could not read X profile')
    }

    const subscription = String(data.data.subscription_type ?? '').toLowerCase()

    return {
      platformAccountId: data.data.id,
      displayName: data.data.username ? `@${data.data.username}` : data.data.name,
      avatarUrl: data.data.profile_image_url,
      hasXPremium: subscription === 'premium' || subscription === 'premiumplus',
    }
  },

  async refreshToken(refreshToken: string): Promise<RefreshedToken> {
    // X uses HTTP Basic auth with the app credentials on the token endpoint.
    const basic = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64')

    const res = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) {
      throw new TokenExpiredError(data?.error_description ?? 'X token refresh failed')
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // X rotates the refresh token on every use
      expiresInSeconds: data.expires_in,
    }
  },

  async publish({
    accessToken,
    caption,
    media,
    accountCapabilities,
  }: PublishInput): Promise<PublishResult> {
    try {
      // X demotes and charges more for posts carrying an outbound link, so the
      // link comes out before the post is measured or sent. Validating the
      // stripped text — not what the user typed — means a caption that only
      // exceeded 280 because of a long URL still publishes.
      const text = stripLinks(caption)

      // Shared with the mock adapters so both enforce identical rules.
      const invalid = validatePost('x', text, media, accountCapabilities)
      if (invalid) return { success: false, errorMessage: invalid }

      const mediaIds: string[] = []
      for (const item of media) {
        mediaIds.push(await uploadMedia(accessToken, item))
      }

      const res = await xFetch(`${API}/tweets`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.data?.id) {
        return {
          success: false,
          errorMessage: data?.detail ?? data?.errors?.[0]?.message ?? 'X post failed',
        }
      }

      return { success: true, platformPostId: data.data.id }
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
