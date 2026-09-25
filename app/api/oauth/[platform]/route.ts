import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { PLATFORMS, Platform } from '@/lib/platforms'
import { supabaseServer } from '@/lib/supabase/server'
import { createPkcePair, sealState, OAUTH_COOKIE, stateCookieOptions } from '@/lib/oauth'
import { mockModeEnabled } from '@/lib/adapters/mock'

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform as Platform
  const config = PLATFORMS[platform]
  if (!config) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  }

  const supabase = supabaseServer()
  // getUser() verifies the JWT with the auth server; getSession() only reads
  // the cookie and trusts it.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const { verifier, challenge } = createPkcePair()
  const sealed = sealState({ nonce, verifier, userId: user.id, platform, issuedAt: Date.now() })

  // Mock mode skips the provider entirely and bounces straight to our own
  // callback. The state cookie is still set and still verified, so the flow
  // being exercised is the real one minus the third party.
  if (mockModeEnabled()) {
    const callback = new URL(`/api/oauth/${platform}/callback`, request.url)
    callback.searchParams.set('code', `mock-code-${nonce}`)
    callback.searchParams.set('state', nonce)

    const response = NextResponse.redirect(callback)
    response.cookies.set(OAUTH_COOKIE, sealed, stateCookieOptions())
    return response
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    return NextResponse.redirect(new URL(`/connect?error=${platform}_not_configured`, request.url))
  }

  const redirectUri = `${request.nextUrl.origin}/api/oauth/${platform}/callback`

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', config.scope)
  // Only the opaque nonce travels through the provider; the user id stays in
  // a signed cookie so a forged callback can't target someone else's account.
  authUrl.searchParams.set('state', nonce)

  if (config.usesPkce) {
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
  }

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(OAUTH_COOKIE, sealed, stateCookieOptions())
  return response
}
