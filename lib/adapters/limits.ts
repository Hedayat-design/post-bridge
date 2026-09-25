/**
 * Per-platform posting limits, shared by the real adapters and the mock ones.
 *
 * Keeping these in one place is what makes mock mode trustworthy: a post that
 * succeeds against the mocks obeys the same rules the live API will enforce,
 * so a demo can't pass where production would fail.
 */

export type PlatformLimits = {
  label: string
  textLimit: number
  maxImages: number
  maxVideos: number
  /** Whether images and video may appear in the same post. */
  allowsMixedMedia: boolean
  /** Whether a post may carry no media at all. */
  allowsTextOnly: boolean
}

export const LIMITS: Record<string, PlatformLimits> = {
  x: {
    label: 'X',
    textLimit: 280,
    maxImages: 4,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: true,
  },
  linkedin: {
    label: 'LinkedIn',
    textLimit: 3000,
    maxImages: 20,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: true,
  },
  instagram: {
    label: 'Instagram',
    textLimit: 2200,
    maxImages: 10,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: false, // Instagram requires media
  },
  facebook: {
    label: 'Facebook',
    textLimit: 63206,
    maxImages: 10,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: true,
  },
  tiktok: {
    label: 'TikTok',
    textLimit: 2200,
    maxImages: 35,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: false, // TikTok requires a video or photo carousel
  },
  youtube: {
    label: 'YouTube',
    textLimit: 5000,
    maxImages: 0,
    maxVideos: 1,
    allowsMixedMedia: false,
    allowsTextOnly: false, // YouTube requires a video
  },
}

export type MediaShape = { contentType: string }

/** Returns an error message, or null when the post is acceptable. */
export function validatePost(
  platform: string,
  caption: string,
  media: MediaShape[]
): string | null {
  const limits = LIMITS[platform]
  if (!limits) return `Unknown platform: ${platform}`

  const images = media.filter((m) => m.contentType.startsWith('image/'))
  const videos = media.filter((m) => m.contentType.startsWith('video/'))

  if (!caption.trim() && media.length === 0) {
    return 'A post needs text or media'
  }
  if (!limits.allowsTextOnly && media.length === 0) {
    return `${limits.label} requires media`
  }
  if (caption.length > limits.textLimit) {
    return `Text is ${caption.length} characters; ${limits.label} allows ${limits.textLimit}`
  }
  if (videos.length > limits.maxVideos) {
    return limits.maxVideos === 1
      ? `${limits.label} accepts only one video per post`
      : `${limits.label} accepts at most ${limits.maxVideos} videos per post`
  }
  if (images.length > limits.maxImages) {
    return limits.maxImages === 0
      ? `${limits.label} does not accept images`
      : `${limits.label} accepts at most ${limits.maxImages} images per post`
  }
  if (!limits.allowsMixedMedia && videos.length > 0 && images.length > 0) {
    return `${limits.label} cannot mix video and images in one post`
  }

  return null
}
