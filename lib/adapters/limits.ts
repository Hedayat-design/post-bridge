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

/**
 * X Premium raises the post limit from 280 characters to 25,000. It is a
 * property of the *account*, not the platform, so it cannot live in LIMITS —
 * see AccountCapabilities and effectiveTextLimit below.
 */
export const X_PREMIUM_TEXT_LIMIT = 25_000

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

/**
 * Capabilities of the specific connected account, which can widen or narrow
 * the platform's defaults. Stored per row in `social_accounts`.
 */
export type AccountCapabilities = {
  /** X only: the account is on X Premium, so it may post up to 25,000 chars. */
  hasXPremium?: boolean
}

/**
 * The caption ceiling for one account, which is not always the platform's.
 * A Premium X account that posts 1,000 characters is doing something valid,
 * and rejecting it at 280 would be our bug, not the platform's.
 */
export function effectiveTextLimit(
  platform: string,
  capabilities: AccountCapabilities = {}
): number {
  const limits = LIMITS[platform]
  if (!limits) return 0
  if (platform === 'x' && capabilities.hasXPremium) return X_PREMIUM_TEXT_LIMIT
  return limits.textLimit
}

// ---------------------------------------------------------------------------
// Platform-required disclosures
// ---------------------------------------------------------------------------

/**
 * TikTok and YouTube require the poster to declare AI-generated content and
 * commercial relationships. These are not cosmetic: publishing undeclared
 * synthetic or sponsored content breaches both platforms' terms, so the shape
 * of a post has to be able to carry the declaration.
 */
export type TiktokOptions = {
  /** Labels the video "Creator labeled as AI-generated". */
  isAigc?: boolean
  /** Paid partnership / branded content (TikTok brand_content_toggle). */
  discloseBrandedContent?: boolean
  /** Promoting your own brand (TikTok brand_organic_toggle). */
  discloseYourBrand?: boolean
  /** "private" publishes visible only to the author (TikTok SELF_ONLY). */
  privacyStatus?: 'public' | 'private'
  allowComment?: boolean
  /** Video posts only. */
  allowDuet?: boolean
  /** Video posts only. */
  allowStitch?: boolean
}

export type YoutubeOptions = {
  /** Discloses realistic altered or synthetic (AI-generated) content. */
  containsSyntheticMedia?: boolean
  /** Discloses paid product placement, sponsorship or endorsement. */
  hasPaidProductPlacement?: boolean
  /** Maps to snippet.tags. YouTube caps the whole set at 500 characters. */
  tags?: string[]
  title?: string
}

export type PlatformOptions = {
  tiktok?: TiktokOptions
  youtube?: YoutubeOptions
}

/** YouTube rejects a tag set whose combined length exceeds this. */
export const YOUTUBE_TAGS_MAX_CHARS = 500

export type MediaShape = { contentType: string }

/**
 * Checks the per-platform options that the platform itself will reject, so a
 * bad combination surfaces before we start uploading bytes.
 * Returns an error message, or null when the options are acceptable.
 */
export function validatePlatformOptions(
  platform: string,
  options: PlatformOptions,
  media: MediaShape[]
): string | null {
  const hasVideo = media.some((m) => m.contentType.startsWith('video/'))

  if (platform === 'tiktok' && options.tiktok) {
    const o = options.tiktok

    if (o.privacyStatus && o.privacyStatus !== 'public' && o.privacyStatus !== 'private') {
      return `TikTok privacy must be "public" or "private", got "${o.privacyStatus}"`
    }
    // TikTok refuses branded content on a self-only post: a paid partnership
    // that nobody can see is treated as an attempt to dodge the disclosure.
    if (o.discloseBrandedContent && o.privacyStatus === 'private') {
      return 'TikTok does not allow branded content on a private post'
    }
    if (!hasVideo && (o.allowDuet || o.allowStitch)) {
      return 'TikTok Duet and Stitch apply to video posts only'
    }
  }

  if (platform === 'youtube' && options.youtube) {
    const tags = options.youtube.tags ?? []
    const totalChars = tags.join('').length
    if (totalChars > YOUTUBE_TAGS_MAX_CHARS) {
      return `YouTube tags total ${totalChars} characters; the limit is ${YOUTUBE_TAGS_MAX_CHARS}`
    }
  }

  return null
}

/** Returns an error message, or null when the post is acceptable. */
export function validatePost(
  platform: string,
  caption: string,
  media: MediaShape[],
  capabilities: AccountCapabilities = {},
  options: PlatformOptions = {}
): string | null {
  const limits = LIMITS[platform]
  if (!limits) return `Unknown platform: ${platform}`

  const images = media.filter((m) => m.contentType.startsWith('image/'))
  const videos = media.filter((m) => m.contentType.startsWith('video/'))
  const textLimit = effectiveTextLimit(platform, capabilities)

  if (!caption.trim() && media.length === 0) {
    return 'A post needs text or media'
  }
  if (!limits.allowsTextOnly && media.length === 0) {
    return `${limits.label} requires media`
  }
  if (caption.length > textLimit) {
    return `Text is ${caption.length} characters; ${limits.label} allows ${textLimit}`
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

  return validatePlatformOptions(platform, options, media)
}
