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
