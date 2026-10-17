import { format } from 'date-fns'
import type { ScheduledPost } from '@/lib/user/dashboard'

/** The queue: every scheduled post, soonest first. */
export function ScheduledPanel({ posts }: { posts: ScheduledPost[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
      <h2 className="mb-4 font-semibold text-ink">Scheduled Posts</h2>
      <div className="space-y-3">
        {posts.length === 0 && <p className="text-sm text-faint">Nothing scheduled yet.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-sunken p-3">
            <span className="w-28 shrink-0 text-xs font-semibold text-primary">
              {p.scheduled_for ? format(new Date(p.scheduled_for), 'MMM d, h:mm a') : '—'}
            </span>
            <span className="min-w-0 truncate text-sm text-ink">{p.caption || `(${p.media_type} post)`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
