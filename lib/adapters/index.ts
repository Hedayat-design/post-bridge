import { PlatformAdapter } from './types'
import { xAdapter } from './x'
import { linkedinAdapter } from './linkedin'
import { unimplementedAdapter } from './stub'
import { mockAdapter, mockModeEnabled } from './mock'
import { LIMITS } from './limits'

// Phase 1 ships X and LinkedIn end to end. The rest fail loudly until their
// real upload flows are built — see lib/adapters/stub.ts.
const liveAdapters: Record<string, PlatformAdapter> = {
  x: xAdapter,
  linkedin: linkedinAdapter,
  instagram: unimplementedAdapter('Instagram'),
  facebook: unimplementedAdapter('Facebook'),
  tiktok: unimplementedAdapter('TikTok'),
  youtube: unimplementedAdapter('YouTube'),
}

// In mock mode every platform is available, including the ones whose real
// adapters aren't built, so the full product can be demonstrated.
const mockAdapters: Record<string, PlatformAdapter> = Object.fromEntries(
  Object.keys(LIMITS).map((platform) => [platform, mockAdapter(platform)])
)

/**
 * Resolved per call rather than at module load, so tests and the dev server
 * pick up the flag without a restart ordering problem.
 */
export const adapters = new Proxy({} as Record<string, PlatformAdapter>, {
  get: (_t, platform: string) =>
    mockModeEnabled() ? mockAdapters[platform] : liveAdapters[platform],
  has: (_t, platform: string) => platform in liveAdapters,
  ownKeys: () => Reflect.ownKeys(liveAdapters),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
})

/** True when a platform can actually publish right now, mock mode included. */
export function platformAvailable(platform: string): boolean {
  if (mockModeEnabled()) return platform in mockAdapters
  return platform === 'x' || platform === 'linkedin'
}
