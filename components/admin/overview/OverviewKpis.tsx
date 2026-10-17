import { percent } from '@/lib/admin/stats'
import { StatTile } from '@/components/admin/ui/StatTile'
import type { OverviewSummary } from '@/lib/admin/overview'

/** The four numbers an owner checks first. */
export function OverviewKpis({ s }: { s: OverviewSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Active members"
        value={String(s.activeMembers)}
        context={s.suspendedMembers > 0 ? `${s.suspendedMembers} suspended` : `${s.managers} can manage the team`}
      />
      <StatTile
        label="Scheduled, next 7 days"
        value={String(s.upcoming.length)}
        tone={s.overdue.length > 0 ? 'attention' : 'default'}
        context={s.overdue.length > 0 ? `${s.overdue.length} overdue — is the scheduler running?` : 'Posts waiting to go out'}
      />
      <StatTile
        label="Delivered, last 30 days"
        value={s.last30.delivered.toLocaleString('en-US')}
        context={`${s.deliveredDelta >= 0 ? '+' : '−'}${Math.abs(s.deliveredDelta)} vs previous 30 days · failure rate ${percent(s.rate30)}`}
      />
      <StatTile
        label="Accounts needing attention"
        value={String(s.accountsNeedingAttention)}
        tone={s.accountsNeedingAttention > 0 ? 'attention' : 'default'}
        context={
          s.accountsNeedingAttention > 0
            ? 'Reconnect before they fail'
            : s.accountsTotal === 0
              ? 'No accounts connected yet'
              : s.accountsTotal === 1
                ? 'The connected account is OK'
                : `All ${s.accountsTotal} connected accounts OK`
        }
      />
    </div>
  )
}
