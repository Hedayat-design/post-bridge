import { format } from 'date-fns'
import { LivePost, deliveredTargets, partialNote } from '@/lib/user/dashboard'

/** The last ten posts that went live, with how many accounts each reached. */
export function LivePanel({ posts }: { posts: LivePost[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
      <h2 className="mb-4 font-semibold text-ink">Live Posts</h2>
      <div className="space-y-3">
        {posts.length === 0 && <p className="text-sm text-faint">Nothing posted yet.</p>}
        {posts.map((p) => {
          const note = partialNote(p)
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-sunken p-3">
              <span className="w-24 shrink-0 text-xs font-semibold text-accent">{format(new Date(p.created_at), 'MMM d')}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.caption || `(${p.media_type} post)`}</span>
              <span className="text-xs text-muted">
                {deliveredTargets(p).length}/{p.post_targets?.length ?? 0} ✓
              </span>
              {/* A partial target is live, so it counts above — but the reply
                  that failed under it has to be visible somewhere, or the row
                  reads as a clean success. */}
              {note && (
                <span className="text-xs text-warning" title={note}>
                  ⚠ reply failed
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
