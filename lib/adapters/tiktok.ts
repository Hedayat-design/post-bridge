import { PlatformAdapter, PublishInput, PublishResult } from './types'

// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
export const tiktokAdapter: PlatformAdapter = {
  async publish({ accessToken, caption, mediaUrls, mediaType }: PublishInput): Promise<PublishResult> {
    try {
      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: caption,
            // TikTok Carousel posts (feature parity with the original product):
            // when mediaType === 'carousel', send `post_mode: 'DIRECT_POST'` with
            // multiple photo_images and TikTok auto-applies trending audio.
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: mediaUrls[0],
          },
        }),
      })

      const data = await initRes.json()
      if (data.error?.code && data.error.code !== 'ok') {
        return { success: false, errorMessage: data.error.message }
      }

      return { success: true, platformPostId: data.data?.publish_id }
    } catch (e) {
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
