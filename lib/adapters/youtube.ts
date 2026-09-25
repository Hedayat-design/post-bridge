import { PlatformAdapter, PublishInput, PublishResult } from './types'

// Docs: https://developers.google.com/youtube/v3/docs/videos/insert
export const youtubeAdapter: PlatformAdapter = {
  async publish({ accessToken, caption, mediaUrls }: PublishInput): Promise<PublishResult> {
    try {
      // Real implementation streams the video file as multipart/resumable upload.
      // Here we reference the already-hosted file via mediaUrls[0] for simplicity —
      // swap in the resumable upload flow before going to production.
      const res = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: { title: caption.slice(0, 100), description: caption },
            status: { privacyStatus: 'public' },
            sourceUrl: mediaUrls[0],
          }),
        }
      )

      const data = await res.json()
      if (data.error) return { success: false, errorMessage: data.error.message }

      return { success: true, platformPostId: data.id }
    } catch (e) {
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
