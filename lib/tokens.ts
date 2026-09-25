import type { SupabaseClient } from '@supabase/supabase-js'
import { adapters } from './adapters'
import { TokenExpiredError } from './adapters/types'

// Refresh a little early so a token can't expire mid-upload.
const SKEW_MS = 5 * 60 * 1000

export type SocialAccountRow = {
  id: string
  platform: string
  platform_account_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
}

/**
 * Returns a usable access token for the account, refreshing and persisting it
 * first if it is expired or about to be. Previously tokens were read straight
 * from the row and every expired account silently failed to publish.
 */
export async function ensureFreshToken(
  admin: SupabaseClient,
  account: SocialAccountRow
): Promise<string> {
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : null
  const stillValid = expiresAt === null || expiresAt - Date.now() > SKEW_MS
  if (stillValid) return account.access_token

  const adapter = adapters[account.platform]
  if (!adapter?.refreshToken || !account.refresh_token) {
    throw new TokenExpiredError(
      `${account.platform} access token expired and cannot be refreshed — reconnect the account`
    )
  }

  const refreshed = await adapter.refreshToken(account.refresh_token)

  await admin
    .from('social_accounts')
    .update({
      access_token: refreshed.accessToken,
      // X rotates refresh tokens, so keep whichever one came back.
      refresh_token: refreshed.refreshToken ?? account.refresh_token,
      token_expires_at: refreshed.expiresInSeconds
        ? new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
        : null,
    })
    .eq('id', account.id)

  return refreshed.accessToken
}
