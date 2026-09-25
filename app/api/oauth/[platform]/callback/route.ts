import { NextRequest, NextResponse } from 'next/server'
import { PLATFORMS, Platform, PLAN_LIMITS, PlatformConfig } from '@/lib/platforms'
import { supabaseAdmin } from '@/lib/supabase/server'
import { adapters } from '@/lib/adapters'
import { mockModeEnabled, mockAccessToken } from '@/lib/adapters/mock'
import { openState, OAUTH_COOKIE } from '@/lib/oauth'

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

function fail(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/connect?error=${reason}`, request.url))
  response.cookies.delete(OAUTH_COOKIE)
  return response
}

/** Swap the authorization code for a token, per the platform's conventions. */
async function exchangeCode(
  config: PlatformConfig,
  platform: string,
  origin: string,
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const clientId = process.env[config.clientIdEnv] ?? ''
  const clientSecret = process.env[config.clientSecretEnv] ?? ''

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${origin}/api/oauth/${platform}/callback`,
    client_id: clientId,
  })
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (config.tokenAuth === 'basic') {
    // X requires the app credentials as HTTP Basic, not form fields.
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  } else {
    body.set('client_secret', clientSecret)
  }

  if (config.usesPkce) body.set('code_verifier', verifier)

  const res = await fetch(config.tokenUrl, { method: 'POST', headers, body })
  if (!res.ok) return {}
  return res.json().catch(() => ({}))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform as Platform
  const config = PLATFORMS[platform]
  const code = request.nextUrl.searchParams.get('code')
  const returnedNonce = request.nextUrl.searchParams.get('state')

  // The provider reports user-cancelled consent here rather than as an error.
  const providerError = request.nextUrl.searchParams.get('error')
  if (providerError) return fail(request, providerError)

  if (!config || !code || !returnedNonce) return fail(request, 'invalid_callback')

  // Verify the signed cookie matches the nonce that came back through the
  // provider. This is what makes the callback forgery-resistant.
  const state = openState(request.cookies.get(OAUTH_COOKIE)?.value)
  if (!state || state.nonce !== returnedNonce || state.platform !== platform) {
    return fail(request, 'state_mismatch')
  }

  const userId = state.userId
  const admin = supabaseAdmin()

  // Enforce plan limits before spending an OAuth round-trip
  const { data: profile } = await admin.from('profiles').select('plan').eq('id', userId).single()
  const { count } = await admin
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const limit = PLAN_LIMITS[profile?.plan ?? 'free']
  if ((count ?? 0) >= limit) {
    const response = NextResponse.redirect(new URL('/pricing?error=account_limit_reached', request.url))
    response.cookies.delete(OAUTH_COOKIE)
    return response
  }

  // ---- Obtain an access token ----
  // Mock mode mints one locally; everything after this point is identical.
  const tokenData: TokenResponse = mockModeEnabled()
    ? {
        access_token: mockAccessToken(userId, platform),
        refresh_token: `mock-rt-${userId}`,
        expires_in: 7200,
      }
    : await exchangeCode(config, platform, request.nextUrl.origin, code, state.verifier)

  if (!tokenData.access_token) return fail(request, 'token_exchange_failed')

  // ---- Read back who this token belongs to ----
  // Without this the row was stored with platform_account_id 'unknown', which
  // collided as soon as a second account on the same platform connected.
  let profileInfo
  try {
    profileInfo = await adapters[platform].fetchProfile(tokenData.access_token)
  } catch {
    return fail(request, 'profile_lookup_failed')
  }

  const { error: upsertError } = await admin.from('social_accounts').upsert(
    {
      user_id: userId,
      platform,
      platform_account_id: profileInfo.platformAccountId,
      display_name: profileInfo.displayName ?? null,
      avatar_url: profileInfo.avatarUrl ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
    },
    // Reconnecting an account must update the existing row, not insert a
    // duplicate — this targets the table's unique constraint.
    { onConflict: 'user_id,platform,platform_account_id' }
  )

  if (upsertError) return fail(request, 'account_save_failed')

  const response = NextResponse.redirect(new URL('/connect?success=1', request.url))
  response.cookies.delete(OAUTH_COOKIE)
  return response
}
