import { AccountCapabilities, PlatformOptions } from './limits'

// Every platform adapter implements this shape. The publisher calls these
// without caring which platform it's talking to.

// Media is downloaded to bytes once by the publisher and handed to every
// adapter, because most platforms require a real byte upload rather than a
// URL reference.
export type MediaItem = {
  url: string
  contentType: string
  bytes: Buffer
  filename: string
}

export type PublishInput = {
  accessToken: string
  caption: string
  media: MediaItem[]
  mediaType: 'image' | 'video' | 'carousel' | 'text'
  /** The account's id on the platform — several APIs need it in the path/body. */
  platformAccountId: string
  /**
   * What this particular account can do, where it differs from the platform
   * default. X Premium raising the caption limit is the current case.
   */
  accountCapabilities?: AccountCapabilities
  /**
   * Per-platform settings and the disclosures TikTok and YouTube require for
   * AI-generated or sponsored content.
   */
  platformOptions?: PlatformOptions
}

export type PublishResult = {
  success: boolean
  platformPostId?: string
  errorMessage?: string
}

/** Identity of the connected account, read back from the platform after OAuth. */
export type PlatformProfile = {
  platformAccountId: string
  displayName?: string
  avatarUrl?: string
  /** X only: read from the profile so the caption limit can follow the account. */
  hasXPremium?: boolean
}

export type RefreshedToken = {
  accessToken: string
  refreshToken?: string
  expiresInSeconds?: number
}

export interface PlatformAdapter {
  publish(input: PublishInput): Promise<PublishResult>
  /** Called right after the OAuth code exchange to populate social_accounts. */
  fetchProfile(accessToken: string): Promise<PlatformProfile>
  /** Optional: platforms whose tokens expire implement this. */
  refreshToken?(refreshToken: string): Promise<RefreshedToken>
}

/** Thrown by adapters when the platform rejects the token specifically. */
export class TokenExpiredError extends Error {
  constructor(message = 'Access token expired or revoked') {
    super(message)
    this.name = 'TokenExpiredError'
  }
}
