import { percent } from '@/lib/admin/stats'
import { StatTile } from '@/components/admin/ui/StatTile'
import type { PublishingSummary } from '@/lib/admin/publishing'

export function PublishingKpis({ s }: { s: PublishingSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Delivered, last 30 days"
        value={s.total.delivered.toLocaleString('en-US')}
        context="Includes posts whose reply failed"
      />
      <StatTile
        label="Failed, last 30 days"
        value={s.total.failed.toLocaleString('en-US')}
        tone={s.total.failed > 0 ? 'attention' : 'default'}
        context={s.total.failed > 0 ? 'Reasons below' : 'Nothing failed'}
      />
      <StatTile label="Failure rate" value={percent(s.rate)} context="Failed ÷ (delivered + failed)" />
      <StatTile
        label="Scheduled"
        value={String(s.scheduled.length)}
        tone={s.overdue.length > 0 ? 'attention' : 'default'}
        context={s.overdue.length > 0 ? `Plus ${s.overdue.length} overdue` : 'Waiting to publish'}
      />
    </div>
  )
}
