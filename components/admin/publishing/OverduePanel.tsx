import { Panel } from '@/components/admin/ui/Panel'
import { relativeTime } from '@/lib/admin/stats'
import { authorName } from '@/lib/admin/publishing'
import type { AdminPost } from '@/lib/admin/data'

/**
 * Posts still marked scheduled after their time passed. Neither upcoming nor
 * failed — the scheduler (/api/cron) has not picked them up — so they get
 * their own warning. Renders nothing when there are none.
 */
export function OverduePanel({
  overdue,
  memberById,
  now,
}: {
  overdue: AdminPost[]
  memberById: Map<string, { name: string }>
  now: Date
}) {
  if (overdue.length === 0) return null
  return (
    <Panel
      title={`${overdue.length} overdue post${overdue.length === 1 ? '' : 's'}`}
      subtitle="Still marked scheduled after their time passed — the scheduler (/api/cron) has not picked them up. Check that it is running."
    >
      <ul className="divide-y divide-hairline">
        {overdue.slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
            <span className="w-24 shrink-0 text-xs font-semibold text-ink">due {relativeTime(p.scheduled_for, now)}</span>
            <span className="min-w-0 flex-1 truncate text-ink/85">{p.caption?.trim() || 'No default caption'}</span>
            <span className="shrink-0 text-xs text-muted">{authorName(p.created_by, memberById)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
