import { PlatformAdapter, PublishInput, PublishResult } from './types'

// Docs: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
export const linkedinAdapter: PlatformAdapter = {
  async publish({ accessToken, caption }: PublishInput): Promise<PublishResult> {
    try {
      const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: caption },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, errorMessage: err.message ?? 'LinkedIn post failed' }
      }

      const postId = res.headers.get('x-restli-id') ?? undefined
      return { success: true, platformPostId: postId }
    } catch (e) {
      return { success: false, errorMessage: (e as Error).message }
    }
  },
}
