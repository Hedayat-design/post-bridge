import { PlatformAdapter } from './types'
import { xAdapter } from './x'
import { linkedinAdapter } from './linkedin'
import { unimplementedAdapter } from './stub'

// Phase 1 ships X and LinkedIn end to end. The rest fail loudly until their
// real upload flows are built — see lib/adapters/stub.ts.
export const adapters: Record<string, PlatformAdapter> = {
  x: xAdapter,
  linkedin: linkedinAdapter,
  instagram: unimplementedAdapter('Instagram'),
  facebook: unimplementedAdapter('Facebook'),
  tiktok: unimplementedAdapter('TikTok'),
  youtube: unimplementedAdapter('YouTube'),
}
