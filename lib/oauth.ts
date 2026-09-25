import crypto from 'crypto'

// ============================================================================
// PKCE + signed OAuth state.
//
// The old flow put the raw user id in `state`, which let anyone forge a
// callback for any user. Instead we mint a random nonce, keep the nonce +
// PKCE verifier + user id in an HMAC-signed httpOnly cookie, and send only
// the nonce over the wire. The callback re-derives and compares.
// ============================================================================

export const OAUTH_COOKIE = 'pb_oauth'
const MAX_AGE_SECONDS = 600 // an OAuth round-trip should never take 10 minutes

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function stateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET
  if (!secret) throw new Error('OAUTH_STATE_SECRET is not set')
  return secret
}

export function createPkcePair() {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export type OAuthState = {
  nonce: string
  verifier: string
  userId: string
  platform: string
  issuedAt: number
}

export function sealState(state: OAuthState): string {
  const payload = base64url(Buffer.from(JSON.stringify(state)))
  const mac = crypto.createHmac('sha256', stateSecret()).update(payload).digest()
  return `${payload}.${base64url(mac)}`
}

export function openState(sealed: string | undefined): OAuthState | null {
  if (!sealed) return null
  const [payload, mac] = sealed.split('.')
  if (!payload || !mac) return null

  const expected = base64url(crypto.createHmac('sha256', stateSecret()).update(payload).digest())
  // constant-time compare; timingSafeEqual throws on length mismatch
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState
    if (Date.now() - state.issuedAt > MAX_AGE_SECONDS * 1000) return null
    return state
  } catch {
    return null
  }
}

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // must survive the provider's top-level redirect back
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}
