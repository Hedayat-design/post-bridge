import { Panel } from '@/components/admin/ui/Panel'
import { Avatar } from '@/components/team/Avatar'
import { relativeTime } from '@/lib/admin/stats'
import { PLATFORMS, Platform } from '@/lib/platforms'
import type { AdminData, AdminPost } from '@/lib/admin/data'

/** What goes out in the next 7 days: when, what, where, and who wrote it. */
export function UpcomingPanel({
  upcoming,
  data,
}: {
  upcoming: AdminPost[]
  data: Pick<AdminData, 'accounts' | 'members' | 'now'>
}) {
  const accountById = new Map(data.accounts.map((a) => [a.id, a]))
  const memberById = new Map(data.members.map((m) => [m.id, m]))

  return (
    <Panel title="Going out this week" subtitle={`${upcoming.length} scheduled`}>
      {upcoming.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing scheduled for the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {upcoming.slice(0, 6).map((p) => {
            const author = p.created_by ? memberById.get(p.created_by) : null
            const platforms = Array.from(
              new Set(
                (p.post_targets ?? [])
                  .map((t) => accountById.get(t.social_account_id)?.platform)
                  .filter((x): x is string => Boolean(x))
              )
            )
            return (
              <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-20 shrink-0 text-xs">
                  <p className="font-semibold text-ink">{relativeTime(p.scheduled_for, data.now)}</p>
                  <p className="text-faint">
                    {new Date(p.scheduled_for!).toLocaleString('en-US', {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'UTC',
                    })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p.caption?.trim() || 'No default caption'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {platforms.map((x) => PLATFORMS[x as Platform]?.label ?? x).join(' · ') || 'No accounts'}
                  </p>
                </div>
                {author && (
                  <span title={author.name}>
                    <Avatar name={author.name} size="sm" />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
