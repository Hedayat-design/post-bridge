import { PlatformAdapter, PublishInput, PublishResult } from './types'

// Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
function metaAdapter(nodeType: 'instagram' | 'facebook'): PlatformAdapter {
  return {
    async publish({ accessToken, caption, mediaUrls, mediaType }: PublishInput): Promise<PublishResult> {
      try {
        // Step 1: create a media container
        const containerRes = await fetch(
          `https://graph.facebook.com/v20.0/me/media?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caption,
              [mediaType === 'video' ? 'video_url' : 'image_url']: mediaUrls[0],
            }),
          }
        )
        const container = await containerRes.json()
        if (!container.id) return { success: false, errorMessage: container.error?.message ?? `${nodeType} container failed` }

        // Step 2: publish the container
        const publishRes = await fetch(
          `https://graph.facebook.com/v20.0/me/media_publish?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: container.id }),
          }
        )
        const published = await publishRes.json()
        if (!published.id) return { success: false, errorMessage: published.error?.message ?? `${nodeType} publish failed` }

        return { success: true, platformPostId: published.id }
      } catch (e) {
        return { success: false, errorMessage: (e as Error).message }
      }
    },
  }
}

export const instagramAdapter = metaAdapter('instagram')
export const facebookAdapter = metaAdapter('facebook')
