import { PlatformAdapter, PublishResult, PlatformProfile } from './types'

/**
 * Placeholder for platforms whose real upload flow isn't built yet (Phase 2).
 *
 * These deliberately fail loudly. The previous implementations looked complete
 * but called endpoints and fields that don't exist, so posts were recorded as
 * sent while nothing reached the platform. A visible error beats a silent lie.
 *
 * The earlier drafts are preserved in git history if they're useful as a
 * starting point.
 */
export function unimplementedAdapter(label: string): PlatformAdapter {
  const message = `${label} publishing isn't implemented yet`

  return {
    async publish(): Promise<PublishResult> {
      return { success: false, errorMessage: message }
    },
    async fetchProfile(): Promise<PlatformProfile> {
      throw new Error(`${label} account lookup isn't implemented yet`)
    },
  }
}
