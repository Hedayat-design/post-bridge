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

// Docs:
//   Posts   https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
//   Images  https://learn.microsoft.com/linkedin/marketing/community-management/shares/images-api
//   Videos  https://learn.microsoft.com/linkedin/marketing/community-management/shares/videos-api
//   OIDC    https://learn.microsoft.com/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
const REST = 'https://api.linkedin.com/rest'

// LinkedIn's versioned APIs require this header on every /rest call.
export const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? '202506'

function headers(accessToken: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  }
}

async function liFetch(url: string, accessToken: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(accessToken), ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new TokenExpiredError('LinkedIn rejected the access token')
  return res
}

/**
 * `commentary` is LinkedIn "Little Text": these characters are control syntax
 * and must be backslash-escaped or the API rejects the post.
 */
function escapeCommentary(text: string): string {
  return text.replace(/([\\|{}@[\]()<>#*_~])/g, '\\$1')
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(body)
    return parsed.message ?? parsed.error_description ?? fallback
  } catch {
    return body ? `${fallback}: ${body.slice(0, 200)}` : fallback
  }
}

/** Register the upload, PUT the bytes, return the image URN. */
async function uploadImage(accessToken: string, author: string, item: MediaItem): Promise<string> {
  const initRes = await liFetch(`${REST}/images?action=initializeUpload`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  })
  if (!initRes.ok) {
    throw new Error(await errorMessage(initRes, 'LinkedIn image upload could not be initialized'))
  }

  const { value } = await initRes.json()
  const uploadRes = await fetch(value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': item.contentType },
    body: new Uint8Array(item.bytes),
  })
  if (!uploadRes.ok) throw new Error(await errorMessage(uploadRes, 'LinkedIn image upload failed'))

  return value.image as string
}

/** Videos upload in parts; each part's ETag must be echoed back on finalize. */
async function uploadVideo(accessToken: string, author: string, item: MediaItem): Promise<string> {
  const initRes = await liFetch(`${REST}/videos?action=initializeUpload`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author,
        fileSizeBytes: item.bytes.byteLength,
        uploadCaptions: false,
      },
    }),
  })
  if (!initRes.ok) {
    throw new Error(await errorMessage(initRes, 'LinkedIn video upload could not be initialized'))
  }

  const { value } = await initRes.json()
  const instructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> =
    value.uploadInstructions ?? []
  const etags: string[] = []

  for (const part of instructions) {
    // lastByte is inclusive in LinkedIn's instructions; subarray's end is exclusive.
    const chunk = item.bytes.subarray(part.firstByte, part.lastByte + 1)
    const partRes = await fetch(part.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': item.contentType },
      body: new Uint8Array(chunk),
    })
    if (!partRes.ok) throw new Error(await errorMessage(partRes, 'LinkedIn video part upload failed'))

    const etag = partRes.headers.get('etag')
    if (!etag) throw new Error('LinkedIn did not return an ETag for a video part')
    etags.push(etag)
  }

  const finalizeRes = await liFetch(`${REST}/videos?action=finalizeUpload`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken ?? '',
        uploadedPartIds: etags,
      },
    }),
  })
  if (!finalizeRes.ok) throw new Error(await errorMessage(finalizeRes, 'LinkedIn video finalize failed'))

  return value.video as string
}

export const linkedinAdapter: PlatformAdapter = {
  async fetchProfile(accessToken: string): Promise<PlatformProfile> {
    // /v2/userinfo is the OIDC endpoint backing the `profile`/`openid` scopes.
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 401) throw new TokenExpiredError('LinkedIn rejected the access token')

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.sub) {
      throw new Error(data?.message ?? 'Could not read LinkedIn profile')
    }
    return { platformAccountId: data.sub, displayName: data.name, avatarUrl: data.picture }
  },

  async refreshToken(refreshToken: string): Promise<RefreshedToken> {
    // Refresh tokens are only issued to apps approved for them; otherwise
    // LinkedIn access tokens simply expire at 60 days and the user reconnects.
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) {
      throw new TokenExpiredError(data?.error_description ?? 'LinkedIn token refresh failed')
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    }
  },

  async publish({ accessToken, caption, media, platformAccountId }: PublishInput): Promise<PublishResult> {
    try {
      // Shared with the mock adapters so both enforce identical rules.
      const invalid = validatePost('linkedin', caption, media)
      if (invalid) return { success: false, errorMessage: invalid }

      // This is the field the previous implementation omitted entirely, which
      // made every LinkedIn post fail with a 400.
      const author = `urn:li:person:${platformAccountId}`

      const videos = media.filter((m) => m.contentType.startsWith('video/'))
      const images = media.filter((m) => m.contentType.startsWith('image/'))

      let content: Record<string, unknown> | undefined
      if (videos.length === 1) {
        content = { media: { id: await uploadVideo(accessToken, author, videos[0]) } }
      } else if (images.length === 1) {
        content = { media: { id: await uploadImage(accessToken, author, images[0]) } }
      } else if (images.length > 1) {
        const urns: string[] = []
        for (const image of images) urns.push(await uploadImage(accessToken, author, image))
        content = { multiImage: { images: urns.map((id) => ({ id })) } }
      }

      const res = await liFetch(`${REST}/posts`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          commentary: escapeCommentary(caption),
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          ...(content ? { content } : {}),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      })

      if (!res.ok) {
        return { success: false, errorMessage: await errorMessage(res, 'LinkedIn post failed') }
      }

      // The Posts API returns the URN in a header, not the body.
      const postId = res.headers.get('x-restli-id') ?? undefined
      return { success: true, platformPostId: postId }
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
