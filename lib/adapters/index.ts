import { PlatformAdapter } from './types'
import { xAdapter } from './x'
import { instagramAdapter, facebookAdapter } from './meta'
import { tiktokAdapter } from './tiktok'
import { linkedinAdapter } from './linkedin'
import { youtubeAdapter } from './youtube'

export const adapters: Record<string, PlatformAdapter> = {
  x: xAdapter,
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  tiktok: tiktokAdapter,
  linkedin: linkedinAdapter,
  youtube: youtubeAdapter,
}
