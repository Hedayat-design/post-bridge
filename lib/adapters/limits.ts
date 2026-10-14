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

/**
 * The rules that need only the caption and how many media items there are.
 *
 * Split out because these can be checked before anything is uploaded: the
 * create-post route knows every per-platform caption and media URL up front,
 * while the content types that the image/video rules need only exist once the
 * bytes have been downloaded at publish time. A caption that cannot possibly
 * publish is worth rejecting while the user is still looking at it.
 *
 * Expects the caption as the platform will store it: X measures its posts after
 * links are stripped (see captionAsPublished in overrides.ts).
 */
export function validateCaptionAndCount(
  platform: string,
  caption: string,
  mediaCount: number,
  capabilities: AccountCapabilities = {}
): string | null {
  const limits = LIMITS[platform]
  if (!limits) return `Unknown platform: ${platform}`

  if (!caption.trim() && mediaCount === 0) {
    return 'A post needs text or media'
  }
  if (!limits.allowsTextOnly && mediaCount === 0) {
    return `${limits.label} requires media`
  }

  const textLimit = effectiveTextLimit(platform, capabilities)
  if (caption.length > textLimit) {
    return `Text is ${caption.length} characters; ${limits.label} allows ${textLimit}`
  }

  return null
}

// ---------------------------------------------------------------------------
// Platform-required disclosures
// ---------------------------------------------------------------------------

/**
 * X replies: a "first comment" and a thread hanging under the main post.
 *
 * The first comment exists because of link stripping. X demotes a post that
 * carries an outbound link, so `stripLinks` takes the URL out of the tweet
 * body (see x-links.ts) — which would simply lose it. The first comment is
 * where it goes instead, and it is the one place links are deliberately
 * *not* stripped. Removing them there would defeat the whole purpose.
 *
 * Keyed as `x` on PlatformOptions, matching our platform id, though upstream
 * names the same config block "twitter".
 */
export type TwitterOptions = {
  /**
   * Published as a reply to the main tweet once it is live. Links are kept.
   */
  firstComment?: string
  /**
   * Each entry is published as a reply to the one before it, in order, under
   * the main post. Text only — X threads carry no media in our model.
   */
  thread?: string[]
}

/** X caps a thread built through the API at this many replies. */
export const X_THREAD_MAX_ENTRIES = 25

/** A reply waiting to go out, labelled so a failure can say which one. */
export type PlannedReply = { label: string; text: string }

/**
 * The replies that go out under an X post, in the order they are published:
 * the first comment directly under the main tweet, then each thread entry
 * replying to the one before it.
 *
 * The real adapter, the mock adapter and the validator all read the chain
 * from here, so mock mode cannot order or label it differently from live.
 */
export function plannedXReplies(options: TwitterOptions = {}): PlannedReply[] {
  const firstComment: PlannedReply[] =
    options.firstComment === undefined
      ? []
      : [{ label: 'first comment', text: options.firstComment }]

  return [
    ...firstComment,
    ...(options.thread ?? []).map((text, i) => ({
      label: `thread entry ${i + 1}`,
      text,
    })),
  ]
}

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
  x?: TwitterOptions
  tiktok?: TiktokOptions
  youtube?: YoutubeOptions
}

/** YouTube rejects a tag set whose combined length exceeds this. */
export const YOUTUBE_TAGS_MAX_CHARS = 500

export type MediaShape = { contentType: string }

/**
 * Every reply is a tweet in its own right, so each one has to clear the same
 * ceiling the main post does — including the Premium ceiling, which is why
 * this needs the account's capabilities and not just the platform.
 *
 * Upstream trims an over-long reply to the limit. We reject instead, for the
 * same reason x-links.ts prefers a missed link to an over-eager match:
 * quietly cutting the end off someone's sentence is worse than telling them
 * it does not fit. The main caption is already rejected rather than trimmed,
 * so this keeps one rule for the whole post.
 */
export function validateXReplies(
  options: TwitterOptions,
  capabilities: AccountCapabilities = {}
): string | null {
  const limit = effectiveTextLimit('x', capabilities)
  const thread = options.thread ?? []

  if (thread.length > X_THREAD_MAX_ENTRIES) {
    return `X threads are limited to ${X_THREAD_MAX_ENTRIES} replies; this one has ${thread.length}`
  }

  // A blank reply is not a no-op: X rejects an empty tweet, and the chain
  // would break on it after the main post was already live.
  for (const { label, text } of plannedXReplies(options)) {
    if (!text.trim()) return `X ${label} is empty`
    if (text.length > limit) {
      return `X ${label} is ${text.length} characters; X allows ${limit}`
    }
  }

  return null
}

/**
 * Checks the per-platform options that the platform itself will reject, so a
 * bad combination surfaces before we start uploading bytes.
 * Returns an error message, or null when the options are acceptable.
 */
export function validatePlatformOptions(
  platform: string,
  options: PlatformOptions,
  media: MediaShape[],
  capabilities: AccountCapabilities = {}
): string | null {
  const hasVideo = media.some((m) => m.contentType.startsWith('video/'))

  if (platform === 'x' && options.x) {
    const invalid = validateXReplies(options.x, capabilities)
    if (invalid) return invalid
  }


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

// ---------------------------------------------------------------------------
// Sanitizing what a client sends
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * A list of strings, or nothing. A list with one bad entry is dropped whole
 * rather than filtered: publishing a *subset* of a thread someone wrote is a
 * silently wrong post, where dropping it leaves a single tweet they can see
 * went out alone.
 */
function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.every((entry) => typeof entry === 'string') ? (value as string[]) : undefined
}

/** Drops keys whose value came back undefined, so the column stays tidy. */
function compact<T extends object>(object: T): T | undefined {
  const entries = Object.entries(object).filter(([, value]) => value !== undefined)
  return entries.length ? (Object.fromEntries(entries) as T) : undefined
}

/**
 * Keeps only the well-formed platform options, for persisting what a client
 * sent into `posts.platform_options`.
 *
 * Unlike the caption overrides in overrides.ts, which are resolved away before
 * an adapter sees them, these are passed *straight through* to the platform —
 * so this is the last point at which a wrong type can be caught. Anything that
 * is not what it claims to be is dropped rather than coerced: a `thread` of
 * `[1, 2]` is a client bug, and tweeting "1" at someone's followers is worse
 * than posting no thread at all.
 *
 * Validation is a separate job: this decides what is *storable*, while
 * validatePost decides what is *publishable*.
 */
export function sanitizePlatformOptions(raw: unknown): PlatformOptions {
  if (!isRecord(raw)) return {}

  const options: PlatformOptions = {}

  if (isRecord(raw.x)) {
    const x = compact<TwitterOptions>({
      firstComment: asString(raw.x.firstComment),
      thread: asStringArray(raw.x.thread),
    })
    if (x) options.x = x
  }

  if (isRecord(raw.tiktok)) {
    const privacy = asString(raw.tiktok.privacyStatus)
    const tiktok = compact<TiktokOptions>({
      isAigc: asBoolean(raw.tiktok.isAigc),
      discloseBrandedContent: asBoolean(raw.tiktok.discloseBrandedContent),
      discloseYourBrand: asBoolean(raw.tiktok.discloseYourBrand),
      // An unrecognised privacy value is dropped, not passed on: TikTok's
      // default is the stricter of the two, and guessing is not ours to do.
      privacyStatus: privacy === 'public' || privacy === 'private' ? privacy : undefined,
      allowComment: asBoolean(raw.tiktok.allowComment),
      allowDuet: asBoolean(raw.tiktok.allowDuet),
      allowStitch: asBoolean(raw.tiktok.allowStitch),
    })
    if (tiktok) options.tiktok = tiktok
  }

  if (isRecord(raw.youtube)) {
    const youtube = compact<YoutubeOptions>({
      containsSyntheticMedia: asBoolean(raw.youtube.containsSyntheticMedia),
      hasPaidProductPlacement: asBoolean(raw.youtube.hasPaidProductPlacement),
      tags: asStringArray(raw.youtube.tags),
      title: asString(raw.youtube.title),
    })
    if (youtube) options.youtube = youtube
  }

  return options
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

  const invalidText = validateCaptionAndCount(platform, caption, media.length, capabilities)
  if (invalidText) return invalidText
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

  return validatePlatformOptions(platform, options, media, capabilities)
}
