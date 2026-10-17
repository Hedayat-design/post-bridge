import { loadAdminData } from '@/lib/admin/data'
import { buildRoster } from '@/lib/admin/team'
import { getAccess } from '@/lib/team/access'
import { Role } from '@/lib/team/roles'
import { PageHeader } from '@/components/admin/ui/PageHeader'
import { Panel } from '@/components/admin/ui/Panel'
import { ActivityFeed } from '@/components/admin/activity/ActivityFeed'
import { TeamManager } from '@/components/admin/team/TeamManager'
import { TeamModeNotice } from '@/components/admin/team/TeamModeNotice'
import { RolesGuide } from '@/components/admin/team/RolesGuide'

/** Admin → Team: the roster, what the team has been doing, and what roles mean. */
export default async function AdminTeam() {
  const [data, access] = await Promise.all([loadAdminData(), getAccess()])
  // Outside team mode the signed-in user owns the workspace outright.
  const actor = access.teamMode ? access.member : null
  const actorRole: Role = actor?.role ?? 'owner'

  return (
    <>
      <PageHeader eyebrow="Admin" title="Team" />
      <TeamModeNotice />

      <Panel title="Members">
        <TeamManager members={buildRoster(data)} actorId={actor?.id ?? null} actorRole={actorRole} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Activity" subtitle="The last 60 things the team did">
          <ActivityFeed items={data.activity} now={data.now} />
        </Panel>
        <RolesGuide roles={data.members.map((m) => m.role)} />
      </div>
    </>
  )
}
