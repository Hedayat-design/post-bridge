/**
 * Team mode: the whole app without login, for a team using it locally.
 *
 * On, the server signs into one shared workspace account (WORKSPACE_EMAIL /
 * WORKSPACE_PASSWORD) and each person picks their name on /who instead of
 * signing in. Off, the app behaves exactly as it does with real login — so
 * turning login back on before launch is unsetting TEAM_MODE.
 *
 * Deliberately refused in production unless ALLOW_TEAM_MODE_IN_PRODUCTION=1:
 * anyone who can reach a team-mode deployment can act as any member. Edge-safe
 * (env reads only), because middleware imports it.
 */

export const MEMBER_COOKIE = 'pb_member'

export type TeamModeState = 'off' | 'on' | 'blocked'

function flag(value: string | undefined) {
  return value === '1' || value === 'true'
}

/** Never throws, so it is safe at build time (the banner, static pages). */
export function teamModeState(): TeamModeState {
  if (!flag(process.env.TEAM_MODE)) return 'off'
  if (process.env.NODE_ENV === 'production' && !flag(process.env.ALLOW_TEAM_MODE_IN_PRODUCTION)) {
    return 'blocked'
  }
  return 'on'
}

export const TEAM_MODE_BLOCKED_MESSAGE =
  'TEAM_MODE is set in a production build. Team mode has no login, so anyone who can reach ' +
  'this server could act as any member. Unset TEAM_MODE, or set ALLOW_TEAM_MODE_IN_PRODUCTION=1 ' +
  'if this server is only reachable by your team.'

/** For request-time callers: true when on, throws when blocked. */
export function teamModeEnabled(): boolean {
  const state = teamModeState()
  if (state === 'blocked') throw new Error(TEAM_MODE_BLOCKED_MESSAGE)
  return state === 'on'
}

export function workspaceCredentials(): { email: string; password: string } | null {
  const email = process.env.WORKSPACE_EMAIL
  const password = process.env.WORKSPACE_PASSWORD
  return email && password ? { email, password } : null
}

export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
