import { Avatar } from '@/components/team/Avatar'
import { describeActivity } from '@/lib/admin/activity'
import { relativeTime } from '@/lib/admin/stats'
import type { Activity } from '@/lib/admin/data'

/** "Sam scheduled a post to 3 accounts · 5 min ago", newest first. */
export function ActivityFeed({ items, now }: { items: Activity[]; now: Date }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Nothing yet. Activity appears here as the team works.</p>
  }
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const who = a.member_name ?? 'Someone'
        return (
          <li key={a.id} className="flex gap-3">
            <Avatar name={who} size="sm" muted={!a.member_id} />
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p className="text-ink/90">
                <span className="font-semibold text-ink">{who}</span> {describeActivity(a)}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                <time dateTime={a.created_at}>{relativeTime(a.created_at, now)}</time>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
