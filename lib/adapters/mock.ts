import crypto from 'crypto'
import {
  PlatformAdapter,
  PublishInput,
  PublishResult,
  PlatformProfile,
  RefreshedToken,
  TokenExpiredError,
} from './types'
import { LIMITS, validatePost } from './limits'

/**
 * Fake platforms for local development and demos.
 *
 * Enabled with NEXT_PUBLIC_PLATFORM_MOCK=1. Every adapter is replaced by one
 * that validates the post against the same shared limits the live adapters
 * use, then returns a synthetic id instead of calling out. That makes the
 * whole app — connect, compose, schedule, cron, dashboard — clickable end to
 * end with no developer apps registered anywhere.
 *
 * Nothing leaves the machine, so this is also how you exercise failure paths
 * (expired tokens, rejected posts) that are awkward to trigger for real.
 */

export function mockModeEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_PLATFORM_MOCK
  if (flag !== '1' && flag !== 'true') return false

  // A misconfigured production deploy silently not posting anything would be
  // far worse than a crash on boot.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_IN_PRODUCTION !== '1') {
    throw new Error(
      'NEXT_PUBLIC_PLATFORM_MOCK is set in production. Posts would be faked. ' +
        'Unset it, or set ALLOW_MOCK_IN_PRODUCTION=1 if this is a demo deploy.'
    )
  }
  return true
}

/**
 * Captions can steer the mock so failure handling is testable by hand:
 *   "[fail]"    — the platform rejects the post
 *   "[expired]" — the token is rejected, as if it had been revoked
 *   "[slow]"    — takes ~3s, to watch the pending state in the UI
 */
function directive(caption: string, name: string): boolean {
  return caption.toLowerCase().includes(`[${name}]`)
}

export function mockAdapter(platform: string): PlatformAdapter {
  const label = LIMITS[platform]?.label ?? platform

  return {
    async publish({ caption, media }: PublishInput): Promise<PublishResult> {
      if (directive(caption, 'expired')) {
        throw new TokenExpiredError(`${label} rejected the access token (mock)`)
      }

      // Same rules as the live adapter, so a post that works here works there.
      const invalid = validatePost(platform, caption, media)
      if (invalid) return { success: false, errorMessage: invalid }

      if (directive(caption, 'fail')) {
        return { success: false, errorMessage: `${label} rejected the post (mock)` }
      }

      // Rough stand-in for upload time, so scheduled/pending states are visible.
      const delay = directive(caption, 'slow') ? 3000 : 150 + media.length * 200
      await new Promise((r) => setTimeout(r, delay))

      return {
        success: true,
        platformPostId: `mock-${platform}-${crypto.randomUUID()}`,
      }
    },

    async fetchProfile(accessToken: string): Promise<PlatformProfile> {
      // Deterministic per token, so reconnecting the same fake account
      // updates its row instead of creating a second one.
      const hash = crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 12)

      return {
        platformAccountId: `mock-${platform}-${hash}`,
        displayName: platform === 'x' ? `@demo_${hash.slice(0, 6)}` : `Demo ${label} Account`,
        avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${hash}`,
      }
    },

    async refreshToken(): Promise<RefreshedToken> {
      return {
        accessToken: `mock-at-${crypto.randomUUID()}`,
        refreshToken: `mock-rt-${crypto.randomUUID()}`,
        expiresInSeconds: 7200,
      }
    },
  }
}

/** A fake token for the mock OAuth flow, stable for a given user+platform. */
export function mockAccessToken(userId: string, platform: string): string {
  return `mock-token-${crypto
    .createHash('sha256')
    .update(`${userId}:${platform}`)
    .digest('hex')
    .slice(0, 24)}`
}
