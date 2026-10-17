import { StatTile } from '@/components/admin/ui/StatTile'
import { percent } from '@/lib/admin/stats'
import type { UsageSummary } from '@/lib/admin/usage'

export function UsageKpis({ s }: { s: UsageSummary }) {
  const failureShare = s.failed / Math.max(1, s.used)
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile label="Generations" value={s.used.toLocaleString('en-US')} context="This month" />
      <StatTile
        label="Success rate"
        value={percent(s.used ? s.succeeded / s.used : null)}
        context={`${s.failed} failed`}
        tone={s.failed > 0 && failureShare > 0.2 ? 'attention' : 'default'}
      />
      <StatTile
        label="Remaining"
        value={Number.isFinite(s.limit) ? Math.max(0, s.limit - s.used).toLocaleString('en-US') : 'No cap'}
        context="Before captions must be written by hand"
      />
    </div>
  )
}
