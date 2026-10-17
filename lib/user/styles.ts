import { LIMITS } from '@/lib/adapters/limits'

/**
 * Caption styles as the styles page keeps them: one per platform, blank until
 * the user writes one. Pure; the page's state is in
 * components/user/styles/useStylesForm.ts and storage is /api/styles.
 */

export type Style = {
  platform: string
  instructions: string
  examples: string[]
  model: string
  enabled: boolean
}

export const PLATFORMS = Object.keys(LIMITS)

/** The platform's display name, e.g. "X" or "LinkedIn". */
export const platformLabel = (platform: string) => LIMITS[platform]?.label ?? platform

export function blankStyle(platform: string): Style {
  return { platform, instructions: '', examples: [], model: '', enabled: true }
}

/** Every platform's style from GET /api/styles, blank where none is saved. */
export function stylesByPlatform(saved: any[] | undefined): Record<string, Style> {
  const byPlatform: Record<string, Style> = {}
  for (const p of PLATFORMS) byPlatform[p] = blankStyle(p)
  for (const s of saved ?? []) byPlatform[s.platform] = { ...s, examples: s.examples ?? [] }
  return byPlatform
}

/**
 * Whether a platform has a voice set. An example box the user added and left
 * blank is not a configured voice, so only examples with something in them
 * count.
 */
export function isConfigured(style: Style | undefined): boolean {
  return !!(style?.instructions.trim() || style?.examples.some((e) => e.trim()))
}
