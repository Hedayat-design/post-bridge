import { cache } from 'react'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { MEMBER_COOKIE, isUuid, teamModeEnabled } from '@/lib/team/mode'
import { ACTION_LABELS, Action, MemberStatus, ROLE_LABELS, Role, can } from '@/lib/team/roles'

/**
 * Who is acting on this request, and whether they may.
 *
 * Server-only. With team mode off there is no team: the signed-in user owns
 * everything and nothing here restricts them, so the app behaves exactly as
 * it did before team mode existed.
 */

export type Member = {
  id: string
  name: string
  email: string | null
  title: string | null
  role: Role
  status: MemberStatus
  last_active_at: string | null
  created_at: string
}

export const MEMBER_COLUMNS = 'id, name, email, title, role, status, last_active_at, created_at'

export type Access = { teamMode: false } | { teamMode: true; member: Member | null }

/** Memoised per request: the layout, nav and page all ask. */
export const getAccess = cache(async (): Promise<Access> => {
  // Cookies first: reading them marks the route dynamic, so a production
  // build never evaluates the team-mode guard below while prerendering. The
  // guard that matters at run time is middleware's 503.
  const id = cookies().get(MEMBER_COOKIE)?.value
  if (!teamModeEnabled()) return { teamMode: false }

  if (!isUuid(id)) return { teamMode: true, member: null }

  const { data } = await supabaseServer()
    .from('team_members')
    .select(MEMBER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  // A suspended or removed member is treated as nobody: they have to pick
  // again, and the picker will not offer them.
  const member = data && data.status === 'active' ? (data as Member) : null
  return { teamMode: true, member }
})

export function allows(access: Access, action: Action): boolean {
  if (!access.teamMode) return true
  return access.member !== null && can(access.member.role, action)
}

/** The sentence shown when a role is refused. */
export function refusal(access: Access, action: Action): string {
  if (!access.teamMode) return ''
  if (!access.member) return 'Pick who you are first.'
  return `${ROLE_LABELS[access.member.role]}s can’t ${ACTION_LABELS[action]}. Ask an admin to change your role.`
}

/**
 * For API routes: null when allowed, otherwise the response to return.
 * 401 when nobody has been picked (the client sends them to /who), 403 when
 * the role is too low.
 */
export async function forbidUnless(action: Action): Promise<NextResponse | null> {
  const access = await getAccess()
  if (allows(access, action)) return null
  if (access.teamMode && !access.member) {
    return NextResponse.json({ error: refusal(access, action), redirect: '/who' }, { status: 401 })
  }
  return NextResponse.json({ error: refusal(access, action) }, { status: 403 })
}

/** The acting member's id, for created_by columns; null outside team mode. */
export async function actingMemberId(): Promise<string | null> {
  const access = await getAccess()
  return access.teamMode ? access.member?.id ?? null : null
}

/**
 * Appends to the team activity log. Never throws: an audit row that fails to
 * write must not fail the action it describes.
 */
export async function logActivity(
  supabase: SupabaseClient,
  action: string,
  detail: Record<string, unknown> = {},
  actor?: Pick<Member, 'id' | 'name'> | null
) {
  try {
    let who = actor
    if (who === undefined) {
      const access = await getAccess()
      who = access.teamMode ? access.member : null
      if (!access.teamMode) return
    }
    await supabase.from('team_activity').insert({
      member_id: who?.id ?? null,
      member_name: who?.name ?? null,
      action,
      detail,
    })
  } catch {
    // Logged nowhere on purpose; see above.
  }
}
