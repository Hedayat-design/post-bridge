import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { MEMBER_COOKIE, isUuid, memberCookieOptions, teamModeEnabled } from '@/lib/team/mode'
import { MEMBER_COLUMNS, Member, logActivity } from '@/lib/team/access'
import { homeFor } from '@/lib/team/roles'

/**
 * "Who's working?" — team mode's stand-in for signing in.
 *
 * POST picks a member, remembers them in a cookie and says where their role
 * lands (homeFor); DELETE forgets them.
 * There is no password: this records who is acting, it does not prove it.
 */

export async function POST(request: NextRequest) {
  if (!teamModeEnabled()) return NextResponse.json({ error: 'Team mode is off' }, { status: 404 })

  const { memberId } = (await request.json().catch(() => ({}))) as { memberId?: unknown }
  if (!isUuid(memberId)) return NextResponse.json({ error: 'Pick a team member' }, { status: 400 })

  const supabase = supabaseServer()
  const { data } = await supabase.from('team_members').select(MEMBER_COLUMNS).eq('id', memberId).maybeSingle()
  const member = data as Member | null
  if (!member) return NextResponse.json({ error: 'That member no longer exists' }, { status: 404 })
  if (member.status !== 'active') {
    return NextResponse.json({ error: `${member.name} is suspended. Ask an admin.` }, { status: 403 })
  }

  await supabase.from('team_members').update({ last_active_at: new Date().toISOString() }).eq('id', member.id)
  await logActivity(supabase, 'member.signed_in', {}, member)

  const response = NextResponse.json({ ok: true, home: homeFor(member.role) })
  response.cookies.set(MEMBER_COOKIE, member.id, memberCookieOptions())
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(MEMBER_COOKIE, '', { ...memberCookieOptions(), maxAge: 0 })
  return response
}
