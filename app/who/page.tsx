import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { teamModeState } from '@/lib/team/mode'
import { MEMBER_COLUMNS, Member, getAccess } from '@/lib/team/access'
import { SiteMark } from '@/components/site/SiteMark'
import { WhoPicker } from '@/components/team/who/WhoPicker'

/**
 * "Who's working?" — where team mode starts instead of a login page.
 *
 * Outside both route groups on purpose: no nav to wander off through before
 * the app knows who it is talking to.
 */
export const dynamic = 'force-dynamic'

/**
 * Only same-site paths, so ?next= cannot bounce someone to another origin.
 * Null when absent: the picker then sends each role to its own site.
 */
function safeNext(value: string | string[] | undefined): string | null {
  const path = Array.isArray(value) ? value[0] : value
  return path && path.startsWith('/') && !path.startsWith('//') && path !== '/who' ? path : null
}

export default async function WhoPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] }
}) {
  if (teamModeState() !== 'on') notFound()

  const { data } = await supabaseServer().from('team_members').select(MEMBER_COLUMNS).order('name')
  const team = (data ?? []) as Member[]
  const active = team.filter((m) => m.status === 'active')
  const access = await getAccess()
  const currentId = access.teamMode ? access.member?.id ?? null : null

  return (
    <main className="force-dark relative flex flex-1 items-start justify-center px-6 py-16 sm:items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgb(201 154 71 / 0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 100%, rgb(27 54 93 / 0.55), transparent 70%)',
        }}
      />
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2.5">
          <SiteMark />
        </div>
        <h1 className="font-display mt-10 text-center text-4xl font-bold text-ink sm:text-5xl">
          {team.length === 0 ? 'Set up your workspace' : 'Who’s working?'}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-center leading-relaxed text-muted">
          {team.length === 0
            ? 'Post Bridge is running in team mode: no passwords while your team tries it out.'
            : 'Pick your name. There is no password in team mode — this records who did what.'}
        </p>

        <div className="mt-10">
          <WhoPicker
            members={active.map(({ id, name, title, role }) => ({ id, name, title, role }))}
            currentId={currentId}
            next={safeNext(searchParams.next)}
          />
        </div>

        {team.length > 0 && (
          <p className="mt-8 text-center text-sm text-faint">
            Not on the list? Ask an owner or admin to add you.
            {team.length > active.length &&
              ` ${team.length - active.length} suspended member${team.length - active.length === 1 ? ' is' : 's are'} hidden.`}
          </p>
        )}
      </div>
    </main>
  )
}
