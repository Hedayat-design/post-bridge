import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { isUuid } from '@/lib/team/mode'
import { MEMBER_COLUMNS, Member, forbidUnless, getAccess, logActivity } from '@/lib/team/access'
import { MemberChange, ROLE_LABELS, canManage, lastOwnerProblem } from '@/lib/team/roles'
import { parseMemberFields } from '@/lib/team/input'

/**
 * Changes or removes one team member.
 *
 * Every rule lives in lib/team/roles.ts; this route loads the team, asks those
 * rules, and writes. The whole team is loaded because the last-owner check
 * needs it — teams are small enough that this is one cheap query.
 */

type Context = { params: { id: string } }

async function loadTeam() {
  const supabase = supabaseServer()
  const { data, error } = await supabase.from('team_members').select(MEMBER_COLUMNS)
  return { supabase, team: (data ?? []) as Member[], error }
}

async function check(target: Member, team: Member[], changes: MemberChange[]) {
  const access = await getAccess()
  const actor = access.teamMode ? access.member : null

  if (actor) {
    const nextRole = changes.find((c) => c.kind === 'role')
    const next = nextRole && nextRole.kind === 'role' ? nextRole.role : undefined
    if (!canManage(actor.role, target.role, next)) {
      return target.role === 'owner'
        ? 'Only an owner can change an owner.'
        : `${ROLE_LABELS[actor.role]}s can’t make someone ${ROLE_LABELS[next ?? target.role].toLowerCase()}.`
    }
    if (actor.id === target.id && changes.some((c) => c.kind === 'remove' || (c.kind === 'status' && c.status !== 'active'))) {
      return 'You can’t suspend or remove yourself. Ask another admin.'
    }
  }

  for (const change of changes) {
    const problem = lastOwnerProblem(team, target.id, change)
    if (problem) return problem
  }
  return null
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const refused = await forbidUnless('manage_team')
  if (refused) return refused
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Unknown member' }, { status: 404 })

  const parsed = parseMemberFields(await request.json().catch(() => null), { requireName: false })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const fields = parsed.fields
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })

  const { supabase, team, error } = await loadTeam()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const target = team.find((m) => m.id === params.id)
  if (!target) return NextResponse.json({ error: 'Unknown member' }, { status: 404 })

  const changes: MemberChange[] = []
  if (fields.role && fields.role !== target.role) changes.push({ kind: 'role', role: fields.role })
  if (fields.status && fields.status !== target.status) changes.push({ kind: 'status', status: fields.status })
  const problem = await check(target, team, changes)
  if (problem) return NextResponse.json({ error: problem }, { status: 403 })

  const { data, error: updateError } = await supabase
    .from('team_members')
    .update(fields)
    .eq('id', target.id)
    .select(MEMBER_COLUMNS)
    .single()
  if (updateError) {
    if (updateError.code === '23505') {
      return NextResponse.json({ error: 'Someone on the team already uses that email.' }, { status: 409 })
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  for (const change of changes) {
    if (change.kind === 'role') {
      await logActivity(supabase, 'member.role_changed', { name: target.name, from: target.role, to: change.role })
    } else if (change.kind === 'status') {
      await logActivity(supabase, change.status === 'active' ? 'member.reactivated' : 'member.suspended', {
        name: target.name,
      })
    }
  }
  if (fields.name !== undefined || fields.email !== undefined || fields.title !== undefined) {
    await logActivity(supabase, 'member.updated', { name: (data as Member).name })
  }

  return NextResponse.json({ member: data })
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const refused = await forbidUnless('manage_team')
  if (refused) return refused
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Unknown member' }, { status: 404 })

  const { supabase, team, error } = await loadTeam()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const target = team.find((m) => m.id === params.id)
  if (!target) return NextResponse.json({ error: 'Unknown member' }, { status: 404 })

  const problem = await check(target, team, [{ kind: 'remove' }])
  if (problem) return NextResponse.json({ error: problem }, { status: 403 })

  // Their posts stay (created_by is set null); the log keeps their name.
  const { error: deleteError } = await supabase.from('team_members').delete().eq('id', target.id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  await logActivity(supabase, 'member.removed', { name: target.name, role: target.role })
  return NextResponse.json({ ok: true })
}
