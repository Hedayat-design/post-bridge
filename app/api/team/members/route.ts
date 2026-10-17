import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { MEMBER_COOKIE, memberCookieOptions, teamModeEnabled } from '@/lib/team/mode'
import { MEMBER_COLUMNS, Member, forbidUnless, getAccess, logActivity } from '@/lib/team/access'
import { ROLE_LABELS, canManage } from '@/lib/team/roles'
import { parseMemberFields } from '@/lib/team/input'

/**
 * Adds a team member.
 *
 * The very first member of a team-mode workspace needs no permission — there
 * is nobody yet to grant it — and is always made the owner and picked, so the
 * person setting the workspace up lands inside it.
 */
export async function POST(request: NextRequest) {
  const parsed = parseMemberFields(await request.json().catch(() => null), { requireName: true })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const fields = parsed.fields

  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { count } = await supabase.from('team_members').select('id', { count: 'exact', head: true })
  const first = (count ?? 0) === 0

  if (!first) {
    const refused = await forbidUnless('manage_team')
    if (refused) return refused
    const access = await getAccess()
    const role = fields.role ?? 'editor'
    if (access.teamMode && access.member && !canManage(access.member.role, 'viewer', role)) {
      return NextResponse.json(
        { error: `${ROLE_LABELS[access.member.role]}s can’t add ${ROLE_LABELS[role].toLowerCase()}s.` },
        { status: 403 }
      )
    }
  }

  const { data, error } = await supabase
    .from('team_members')
    .insert({
      name: fields.name,
      email: fields.email ?? null,
      title: fields.title ?? null,
      role: first ? 'owner' : fields.role ?? 'editor',
      status: 'active',
      last_active_at: first ? new Date().toISOString() : null,
    })
    .select(MEMBER_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Someone on the team already uses that email.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const member = data as Member
  await logActivity(
    supabase,
    first ? 'workspace.created' : 'member.added',
    { name: member.name, role: member.role },
    first ? member : undefined
  )

  const response = NextResponse.json({ member }, { status: 201 })
  if (first && teamModeEnabled()) {
    response.cookies.set(MEMBER_COOKIE, member.id, memberCookieOptions())
  }
  return response
}
