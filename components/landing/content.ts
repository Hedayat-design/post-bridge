import { PLATFORMS, Platform } from '@/lib/platforms'
import { LIMITS, X_PREMIUM_TEXT_LIMIT } from '@/lib/adapters/limits'

/**
 * Every word and number on the landing page that is not layout.
 *
 * Edit copy here; the section files under ./sections only arrange it. Numbers
 * come from the product's own limits (LIMITS), never typed in, so the page
 * cannot drift from what the app enforces.
 *
 * The rules the copy follows (Ogilvy, not a SaaS template): a "how to"
 * headline that promises a benefit, facts instead of adjectives, long copy for
 * the reader who wants it, the honest caveat in the caption under the picture,
 * one action. No invented testimonials or statistics.
 */

export const n = (value: number) => value.toLocaleString('en-US')

/** Ogilvy spelled out small numbers in copy; so do we. */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const spell = (value: number) => WORDS[value] ?? String(value)

/** "a", "a and b", "a, b and c". */
export function list(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// From the registry, not the adapters: platformAvailable() runs the mock-mode
// guard, which throws during a production build.
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[]
export const LIVE_PLATFORMS = PLATFORM_KEYS.filter((p) => PLATFORMS[p].publishImplemented)
export const SOON_PLATFORMS = PLATFORM_KEYS.filter((p) => !PLATFORMS[p].publishImplemented)
export const platformLabel = (p: Platform) => PLATFORMS[p].label

/** Where each platform sits in the constellation, as % of the box. */
export const STAR_POSITIONS: Record<Platform, { left: number; top: number }> = {
  x: { left: 20, top: 22 },
  linkedin: { left: 13, top: 66 },
  youtube: { left: 36, top: 90 },
  tiktok: { left: 67, top: 86 },
  facebook: { left: 87, top: 60 },
  instagram: { left: 79, top: 17 },
}

/** The one thing per platform the numbers alone don't say. */
export const PLATFORM_NOTES: Record<Platform, string> = {
  x: 'Links are moved out of the post and offered as a reply.',
  linkedin: 'Room for the long version. Written as one.',
  instagram: 'Needs an image or a video — checked before you post.',
  facebook: 'The longest limit of the six, so the caption is written for reading.',
  tiktok: 'Needs a video or a photo carousel.',
  youtube: 'Shorts need a video. The caption becomes its description.',
}

export function mediaLine(platform: Platform) {
  const l = LIMITS[platform]
  if (l.maxImages === 0) return `${l.maxVideos} video per post`
  return `Up to ${l.maxImages} images, or ${l.maxVideos} video`
}

export function textLine(platform: Platform) {
  const limit = LIMITS[platform].textLimit
  if (platform === 'x') return `${n(limit)} characters — ${n(X_PREMIUM_TEXT_LIMIT)} with Premium`
  return `${n(limit)} characters`
}

/** "Eight things…" — the long copy, in reading order. */
export const EIGHT_THINGS = [
  {
    title: 'It reads your image.',
    body: 'Captions are written from the graphic you upload, not from a blank prompt. What is in the picture is what the caption talks about.',
  },
  {
    title: 'It writes in your voice.',
    body: 'Give it a line of instructions and a few posts you wrote yourself, platform by platform. It learns from your examples, not from a generic idea of what goes viral.',
  },
  {
    title: 'It fits every caption to its platform.',
    body: `${n(LIMITS.x.textLimit)} characters on X, or ${n(X_PREMIUM_TEXT_LIMIT)} if your account has Premium. ${n(LIMITS.linkedin.textLimit)} on LinkedIn. ${n(LIMITS.instagram.textLimit)} on Instagram. Counted before you publish, not after it fails.`,
  },
  {
    title: 'It takes links out of X posts.',
    body: 'X shows fewer people a post that carries an outbound link. Post Bridge strips the link from the post and offers it to you as a reply instead. Every other platform keeps its links.',
  },
  {
    title: 'It refuses posts that cannot publish.',
    body: 'Instagram needs an image. YouTube needs a video. A post that breaks a platform’s rules is stopped while you are still looking at it — not at 3 a.m., when the schedule fires.',
  },
  {
    title: 'It lets you overrule it.',
    body: 'Change the caption or the media for one platform, or for one account, and leave everything else exactly as it was.',
  },
  {
    title: 'It publishes every account on its own.',
    body: 'If one platform refuses a post, the others still go out. One failure never takes the rest down with it.',
  },
  {
    title: 'It posts on the minute you choose.',
    body: 'Schedule to the minute, in your own time zone. Then close the tab.',
  },
]

export const STEPS = [
  { title: 'Connect your accounts', body: 'Sign in to each platform once. Post Bridge keeps the connection.' },
  { title: 'Teach it your voice', body: 'For each platform, a line of instructions and a few posts you are proud of.' },
  { title: 'Upload and schedule', body: 'One image, once. Read every caption before anything goes out.' },
]

/** Mirrors app/(marketing)/pricing/page.tsx — change both together. */
export const PRICE_TIERS = [
  { plan: 'Free', price: '$0', accounts: '1 account' },
  { plan: 'Starter', price: '$29', accounts: '5 accounts' },
  { plan: 'Creator', price: '$49', accounts: '15 accounts' },
  { plan: 'Pro', price: '$99', accounts: 'Unlimited' },
]

/** Staggers a [data-reveal] element by `step` × 90ms (see globals.css). */
export const revealDelay = (step: number) => ({ ['--d' as string]: step })
