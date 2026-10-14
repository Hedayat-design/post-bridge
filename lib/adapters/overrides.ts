/**
 * Per-platform and per-account caption/media overrides.
 *
 * A post holds one default caption and one default media list, plus optional
 * overrides keyed by platform and by connected account. What a single target
 * actually publishes is resolved here, and nowhere else:
 *
 *     account override → platform override → the post's own value
 *
 * Each field falls through on its own, so an account that overrides only the
 * caption still picks up its platform's media override. Resolution runs
 * *before* validation, because the caption that has to fit X's 280 characters
 * is the resolved one, not whatever the post happens to carry as its default.
 *
 * Overrides are resolved away before an adapter is called: `PublishInput.caption`
 * is already the resolved caption for that one target. That is why they live in
 * their own columns rather than in `platform_options`, which is passed straight
 * through to the platform (see migration 0005).
 */

import {
  AccountCapabilities,
  LIMITS,
  MediaShape,
  PlatformOptions,
  validateCaptionAndCount,
  validatePost,
} from './limits'
import { stripLinks } from './x-links'

export type TargetOverride = {
  /** Replaces the post's caption. "" is a real override — see readOverride. */
  caption?: string
  /** Replaces the post's media, as storage URLs. [] means "no media here". */
  media?: string[]
}

/** Keyed by platform ('x', 'linkedin', …). */
export type PlatformConfigurations = Record<string, TargetOverride>
/** Keyed by `social_accounts.id`. */
export type AccountConfigurations = Record<string, TargetOverride>

export type OverrideSource = 'account' | 'platform' | 'post'

export type ResolvedTargetContent = {
  caption: string
  mediaUrls: string[]
  /** Which level each field came from. Carried for messages and tests. */
  captionFrom: OverrideSource
  mediaFrom: OverrideSource
}

/**
 * Reads one override out of a configurations map.
 *
 * Both maps arrive from a jsonb column or a request body, so nothing about
 * their shape is guaranteed: an older client, a hand-edited row or a bad
 * migration could leave a number where a caption belongs. Anything that is not
 * the expected type is ignored, which falls through to the post's own value —
 * a post that publishes its default caption is recoverable, a crashed publish
 * loop or a caption of "42" is not.
 *
 * A missing or wrongly-typed field is absent. A present one is honoured even
 * when empty: "" and [] are how a user says "no text here" / "no media here",
 * which is what makes "text on X, image-only on Instagram" expressible.
 */
function readOverride(configurations: unknown, key: string): TargetOverride {
  if (!configurations || typeof configurations !== 'object' || Array.isArray(configurations)) {
    return {}
  }

  const entry = (configurations as Record<string, unknown>)[key]
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {}

  const raw = entry as Record<string, unknown>
  const override: TargetOverride = {}

  if (typeof raw.caption === 'string') override.caption = raw.caption
  // A media list with a non-string entry is dropped whole rather than filtered:
  // publishing a *subset* of the media someone chose is a silently wrong post,
  // while falling back to the post's own media is at least what they wrote.
  if (Array.isArray(raw.media) && raw.media.every((url) => typeof url === 'string')) {
    override.media = raw.media as string[]
  }

  return override
}

/** Keeps only the well-formed overrides, for persisting what a client sent. */
export function sanitizeConfigurations(configurations: unknown): Record<string, TargetOverride> {
  if (!configurations || typeof configurations !== 'object' || Array.isArray(configurations)) {
    return {}
  }

  const clean: Record<string, TargetOverride> = {}
  for (const key of Object.keys(configurations as Record<string, unknown>)) {
    const override = readOverride(configurations, key)
    // An entry that overrode nothing would just be noise in the column.
    if (override.caption !== undefined || override.media !== undefined) clean[key] = override
  }
  return clean
}

export type ResolveTargetArgs = {
  platform: string
  /** `social_accounts.id` of the target. */
  accountId: string
  /** The post's own caption, used when nothing overrides it. */
  caption: string
  /** The post's own media URLs, used when nothing overrides them. */
  mediaUrls: string[]
  platformConfigurations?: unknown
  accountConfigurations?: unknown
}

/** What one target publishes: account override → platform override → post. */
export function resolveTargetContent(args: ResolveTargetArgs): ResolvedTargetContent {
  const forAccount = readOverride(args.accountConfigurations, args.accountId)
  const forPlatform = readOverride(args.platformConfigurations, args.platform)

  const caption =
    forAccount.caption !== undefined
      ? { value: forAccount.caption, from: 'account' as const }
      : forPlatform.caption !== undefined
        ? { value: forPlatform.caption, from: 'platform' as const }
        : { value: args.caption, from: 'post' as const }

  const media =
    forAccount.media !== undefined
      ? { value: forAccount.media, from: 'account' as const }
      : forPlatform.media !== undefined
        ? { value: forPlatform.media, from: 'platform' as const }
        : { value: args.mediaUrls, from: 'post' as const }

  return {
    caption: caption.value,
    mediaUrls: media.value,
    captionFrom: caption.from,
    mediaFrom: media.from,
  }
}

/**
 * The caption as the platform will actually store it.
 *
 * X strips links from the post body before publishing, so the text that has to
 * fit X's limit is the stripped text — a caption that only exceeded 280 because
 * of a long URL is a valid tweet. This is the one place that knows which
 * platforms rewrite a caption on the way out; call it rather than adding a
 * second switch on `platform`.
 */
export function captionAsPublished(platform: string, caption: string): string {
  return platform === 'x' ? stripLinks(caption) : caption
}

/**
 * Validates what one target will actually publish.
 *
 * Takes the *resolved* caption and runs the shared rules against the text the
 * platform will see. Validating the post's default caption instead would reject
 * posts that are fine and accept posts the platform will refuse, which is the
 * whole reason overrides have to be resolved before validation.
 */
export function validateResolvedTarget(args: {
  platform: string
  caption: string
  media: MediaShape[]
  capabilities?: AccountCapabilities
  options?: PlatformOptions
}): string | null {
  return validatePost(
    args.platform,
    captionAsPublished(args.platform, args.caption),
    args.media,
    args.capabilities ?? {},
    args.options ?? {}
  )
}

/**
 * The same check at create time, before any media has been downloaded.
 *
 * A per-platform caption that cannot publish should be rejected while the user
 * is still in the composer, not hours later when a scheduled post fails. Only
 * the rules that need no content types run here; the image/video rules stay at
 * publish time, where the bytes exist. Takes the resolved caption and the
 * resolved media count for one target.
 */
export function preflightResolvedTarget(args: {
  platform: string
  caption: string
  mediaCount: number
  capabilities?: AccountCapabilities
}): string | null {
  return validateCaptionAndCount(
    args.platform,
    captionAsPublished(args.platform, args.caption),
    args.mediaCount,
    args.capabilities ?? {}
  )
}

/**
 * The media type of one target's resolved media.
 *
 * `posts.media_type` describes the post's default media, and stops describing
 * every target as soon as one of them overrides its media — a post with a video
 * can send a single image to LinkedIn. Each target's type is therefore derived
 * from what that target is actually sending.
 */
export function mediaTypeFor(media: MediaShape[]): 'image' | 'video' | 'carousel' | 'text' {
  if (media.length === 0) return 'text'
  if (media.some((m) => m.contentType.startsWith('video/'))) return 'video'
  return media.length > 1 ? 'carousel' : 'image'
}

/**
 * Rejects overrides that can never be published.
 *
 * An override for a platform or account the post isn't going to is dead weight:
 * the user customised a caption and it would silently never be used. Telling
 * them beats storing it, and a typo'd platform key would otherwise look like
 * the override simply didn't work.
 * Returns an error message, or null when every key names a selected target.
 */
export function validateConfigurationTargets(args: {
  platformConfigurations: Record<string, TargetOverride>
  accountConfigurations: Record<string, TargetOverride>
  selectedPlatforms: string[]
  selectedAccountIds: string[]
}): string | null {
  for (const platform of Object.keys(args.platformConfigurations)) {
    if (!(platform in LIMITS)) return `Unknown platform in overrides: ${platform}`
    if (!args.selectedPlatforms.includes(platform)) {
      return `Customised the caption for ${LIMITS[platform].label}, but no ${LIMITS[platform].label} account is selected`
    }
  }

  for (const accountId of Object.keys(args.accountConfigurations)) {
    if (!args.selectedAccountIds.includes(accountId)) {
      return 'Customised the caption for an account that is not selected'
    }
  }

  return null
}
