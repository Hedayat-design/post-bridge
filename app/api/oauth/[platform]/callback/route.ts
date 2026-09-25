import { NextRequest, NextResponse } from 'next/server'
import { PLATFORMS, Platform, PLAN_LIMITS } from '@/lib/platforms'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform as Platform
  const config = PLATFORMS[platform]
  const code = request.nextUrl.searchParams.get('code')
  const userId = request.nextUrl.searchParams.get('state')

  if (!config || !code || !userId) {
    return NextResponse.redirect(new URL('/connect?error=invalid_callback', request.url))
  }

  const admin = supabaseAdmin()

  // Enforce plan limits before spending an OAuth round-trip
  const { data: profile } = await admin.from('profiles').select('plan').eq('id', userId).single()
  const { count } = await admin
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const limit = PLAN_LIMITS[profile?.plan ?? 'free']
  if ((count ?? 0) >= limit) {
    return NextResponse.redirect(new URL('/pricing?error=account_limit_reached', request.url))
  }

  // Exchange the authorization code for an access token
  const redirectUri = `${request.nextUrl.origin}/api/oauth/${platform}/callback`
  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env[config.clientIdEnv] ?? '',
      client_secret: process.env[config.clientSecretEnv] ?? '',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/connect?error=token_exchange_failed', request.url))
  }

  const tokenData = await tokenRes.json()
  // NOTE: each platform's profile-lookup endpoint differs (e.g. GET /me).
  // Add a small per-platform "fetchProfile()" helper in lib/adapters/<platform>.ts
  // and call it here to populate display_name / avatar_url / platform_account_id.

  await admin.from('social_accounts').upsert({
    user_id: userId,
    platform,
    platform_account_id: tokenData.open_id ?? tokenData.user_id ?? 'unknown',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    token_expires_at: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null,
  })

  return NextResponse.redirect(new URL('/connect?success=1', request.url))
}
