import { PlatformAdapter, PublishInput, PublishResult } from './types'

// Docs: https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
export const xAdapter: PlatformAdapter = {
  async publish({ accessToken, caption, mediaUrls }: PublishInput): Promise<PublishResult> {
    try {
      let mediaIds: string[] = []

      // Media must be uploaded to X's media endpoint first, then referenced by id.
      for (const url of mediaUrls) {
        const mediaRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: new URLSearchParams({ media_url: url }), // simplified — real impl streams bytes
        })
        const mediaData = await mediaRes.json()
        if (mediaData.media_id_string) mediaIds.push(mediaData.media_id_string)
      }

      const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: caption,
          ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
        }),
      })

      if (!tweetRes.ok) {
        const err = await tweetRes.json().catch(() => ({}))
        return { success: false, errorMessage: err.detail ?? 'X post failed' }
      }

      const data = await tweetRes.json()
      return { success: true, platformPostId: data.data?.id }
    } catch (e) {
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
