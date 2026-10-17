import { LIMITS, TwitterOptions, effectiveTextLimit, validateXReplies } from '@/lib/adapters/limits'
import { containsLink, extractLinks } from '@/lib/adapters/x-links'
import {
  OverrideSource,
  TargetOverride,
  captionAsPublished,
  preflightResolvedTarget,
  resolveTargetContent,
} from '@/lib/adapters/overrides'

/**
 * The composer's pure logic: caption inheritance, per-account counters, X
 * replies and the /api/posts body. No React and no network, so it runs in a
 * test exactly as it runs in the browser. Form state lives in
 * components/user/compose/useComposeForm.ts.
 */

export type SocialAccount = {
  id: string
  platform: string
  display_name: string | null
  has_x_premium: boolean | null
}

/** A caption map as the composer keeps it: platform or account id → text. */
export type CaptionMap = Record<string, string>

/** The platform's display name, e.g. "X" or "LinkedIn". */
export const tabLabel = (platform: string) => LIMITS[platform]?.label ?? platform

/** A caption the user typed for one platform or account, as an override map. */
export function asConfigurations(captions: CaptionMap): Record<string, TargetOverride> {
  return Object.fromEntries(Object.entries(captions).map(([key, caption]) => [key, { caption }]))
}

/**
 * The map with one override set, or removed when `value` is null. Only the
 * keys present are overrides; an empty string is a deliberate "nothing here",
 * so removing an override means deleting the key, not blanking the text.
 */
export function withOverride(map: CaptionMap, key: string, value: string | null): CaptionMap {
  const next = { ...map }
  if (value === null) delete next[key]
  else next[key] = value
  return next
}

export type InheritedCaption = { text: string; overridden: boolean }

/** What a platform tab shows: its own override, or the default it inherits. */
export function platformCaption(
  platformCaptions: CaptionMap,
  caption: string,
  platform: string
): InheritedCaption {
  return platform in platformCaptions
    ? { text: platformCaptions[platform], overridden: true }
    : { text: caption, overridden: false }
}

/**
 * What an account field shows. An account inherits its *platform's* caption,
 * not the default one, so turning an account override off lands it back on
 * the text shown in the tab above rather than jumping two levels up.
 */
export function accountCaption(
  accountCaptions: CaptionMap,
  platformCaptions: CaptionMap,
  caption: string,
  accountId: string,
  platform: string
): InheritedCaption {
  return accountId in accountCaptions
    ? { text: accountCaptions[accountId], overridden: true }
    : { text: platformCaption(platformCaptions, caption, platform).text, overridden: false }
}

export type ComposeTarget = {
  account: SocialAccount
  source: OverrideSource
  /** The text as the platform will measure it (X strips links first). */
  published: string
  /** What was typed, before stripping — the links to offer moving. */
  typed: string
  limit: number
  error: string | null
  strippedALink: boolean
}

/**
 * One row per selected account, each measured against *its own* caption and
 * its own limit. A single shared counter was wrong as soon as each platform
 * could carry different text — and it was already approximate, since a
 * Premium X account allows 25,000 characters where a standard one allows 280.
 * The numbers come from the same resolution and validation the server runs,
 * so what the user sees here is what the API will say.
 */
export function composeTargets(args: {
  accounts: SocialAccount[]
  caption: string
  platformConfigurations: Record<string, TargetOverride>
  accountConfigurations: Record<string, TargetOverride>
  mediaCount: number
}): ComposeTarget[] {
  return args.accounts.map((account) => {
    const content = resolveTargetContent({
      platform: account.platform,
      accountId: account.id,
      caption: args.caption,
      // Media is uploaded on submit, so only its count is known here; the
      // composer doesn't offer per-platform media, so every target gets it.
      mediaUrls: [],
      platformConfigurations: args.platformConfigurations,
      accountConfigurations: args.accountConfigurations,
    })
    const capabilities = { hasXPremium: account.has_x_premium ?? false }

    return {
      account,
      source: content.captionFrom,
      // X strips links out of the post body before publishing, so the text it
      // measures is shorter than what was typed.
      published: captionAsPublished(account.platform, content.caption),
      typed: content.caption,
      limit: effectiveTextLimit(account.platform, capabilities),
      error: preflightResolvedTarget({
        platform: account.platform,
        caption: content.caption,
        mediaCount: args.mediaCount,
        capabilities,
      }),
      strippedALink: account.platform === 'x' && containsLink(content.caption),
    }
  })
}

/**
 * The tightest limit among the selected accounts on one platform — what a
 * generated caption for that platform has to fit.
 */
export function strictestLimit(platform: string, accounts: SocialAccount[]): number {
  return Math.min(
    ...accounts
      .filter((a) => a.platform === platform)
      .map((a) => effectiveTextLimit(platform, { hasXPremium: a.has_x_premium ?? false }))
  )
}

/**
 * The X reply options from the form. A blank field means "no first comment";
 * a blank *thread row* is a row the user added and left empty, which
 * validation complains about rather than quietly dropping.
 */
export function xReplyOptions(firstComment: string, thread: string[]): TwitterOptions {
  const options: TwitterOptions = {}
  if (firstComment.trim()) options.firstComment = firstComment
  if (thread.length) options.thread = thread
  return options
}

export function hasXReplies(options: TwitterOptions): boolean {
  return options.firstComment !== undefined || options.thread !== undefined
}

/**
 * The replies measured against each selected X account, because Premium
 * raises the ceiling for a reply exactly as it does for the post. Same
 * function the API and the adapter use, so the composer cannot disagree
 * with them.
 */
export function xReplyError(xAccounts: SocialAccount[], options: TwitterOptions): string | null {
  return hasXReplies(options)
    ? xAccounts
        .map((a) => validateXReplies(options, { hasXPremium: a.has_x_premium ?? false }))
        .find((error) => error !== null) ?? null
    : null
}

/**
 * Links X will take out of the post body, offered for the first comment —
 * only the ones not already in the reply, so the offer disappears as it is
 * taken up and a second link does not re-add the first.
 */
export function linksToOffer(targets: ComposeTarget[], firstComment: string): string[] {
  const stripped = Array.from(
    new Set(targets.filter((t) => t.account.platform === 'x').flatMap((t) => extractLinks(t.typed)))
  )
  return stripped.filter((link) => !firstComment.includes(link))
}

/**
 * Appends links to the first comment rather than replacing it: the user may
 * have written the reply already and only be missing the link.
 */
export function appendLinks(current: string, links: string[]): string {
  return [current.trim(), links.join(' ')].filter(Boolean).join(' ')
}

/** "2 replies under the post", or "No replies". */
export function replyCountLabel(firstComment: string, thread: string[]): string {
  if (!(firstComment.trim() || thread.length)) return 'No replies'
  const count = (firstComment.trim() ? 1 : 0) + thread.length
  return `${count} ${count === 1 ? 'reply' : 'replies'} under the post`
}

/** The media_type for /api/posts, from the chosen files. */
export function composeMediaType(files: { type: string }[]): string {
  const hasVideo = files.some((f) => f.type.startsWith('video'))
  return !files.length ? 'text' : hasVideo ? 'video' : files.length > 1 ? 'carousel' : 'image'
}

/** The JSON body for POST /api/posts. */
export function postRequestBody(args: {
  caption: string
  mediaUrls: string[]
  mediaType: string
  scheduleAt: string
  selected: string[]
  selectedPlatforms: string[]
  platformConfigurations: Record<string, TargetOverride>
  accountConfigurations: Record<string, TargetOverride>
  xOptions: TwitterOptions
  hasXAccount: boolean
}) {
  return {
    caption: args.caption,
    mediaUrls: args.mediaUrls,
    mediaType: args.mediaType,
    // datetime-local yields a naive local string. Converting to a real
    // instant here is what stops posts firing at the wrong hour.
    scheduledFor: args.scheduleAt ? new Date(args.scheduleAt).toISOString() : null,
    socialAccountIds: args.selected,
    // Only the platforms and accounts the user actually customised. An
    // override for something that is no longer selected would be rejected,
    // so drop it rather than sending work the user can't see.
    platformConfigurations: Object.fromEntries(
      Object.entries(args.platformConfigurations).filter(([p]) => args.selectedPlatforms.includes(p))
    ),
    accountConfigurations: Object.fromEntries(
      Object.entries(args.accountConfigurations).filter(([id]) => args.selected.includes(id))
    ),
    // Only when an X account is actually selected: the API rejects a
    // first comment with nowhere to go, and it would be right to.
    platformOptions: args.hasXAccount && hasXReplies(args.xOptions) ? { x: args.xOptions } : {},
  }
}
