import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

// A post target that published but lost a reply underneath it still went out,
// so it counts as delivered; see the 'partial' status in supabase/schema.sql.
function delivered(post: any) {
  return (post.post_targets ?? []).filter(
    (t: any) => t.status === 'posted' || t.status === 'partial'
  )
}

function partialNote(post: any): string | null {
  const partial = (post.post_targets ?? []).find((t: any) => t.status === 'partial')
  return partial?.error_message ?? null
}

export default async function DashboardPage() {
  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', session.user.id).single()

  const { data: accounts } = await supabase
    .from('social_accounts').select('id').eq('user_id', session.user.id)

  const { data: scheduled } = await supabase
    .from('posts')
    .select('id, caption, scheduled_for, media_type')
    .eq('user_id', session.user.id)
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })

  const { data: live } = await supabase
    .from('posts')
    .select('id, caption, created_at, media_type, post_targets(status, error_message)')
    .eq('user_id', session.user.id)
    .eq('status', 'posted')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">
            {accounts?.length ?? 0} accounts connected · {profile?.plan ?? 'free'} plan
          </p>
        </div>
        <Link href="/compose" className="bg-primary text-primary-fg font-semibold px-5 py-2.5 rounded-lg shadow-card transition-colors hover:bg-primary-hover">
          + New post
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-hairline bg-surface rounded-2xl p-6 shadow-card min-w-0">
          <h2 className="font-semibold text-ink mb-4">Scheduled Posts</h2>
          <div className="space-y-3">
            {(scheduled?.length ?? 0) === 0 && (
              <p className="text-sm text-faint">Nothing scheduled yet.</p>
            )}
            {scheduled?.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-sunken rounded-xl p-3">
                <span className="text-xs font-semibold text-primary w-28 shrink-0">
                  {p.scheduled_for ? format(new Date(p.scheduled_for), 'MMM d, h:mm a') : '—'}
                </span>
                <span className="text-sm text-ink truncate min-w-0">{p.caption || `(${p.media_type} post)`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-hairline bg-surface rounded-2xl p-6 shadow-card min-w-0">
          <h2 className="font-semibold text-ink mb-4">Live Posts</h2>
          <div className="space-y-3">
            {(live?.length ?? 0) === 0 && (
              <p className="text-sm text-faint">Nothing posted yet.</p>
            )}
            {live?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-sunken rounded-xl p-3">
                <span className="text-xs font-semibold text-accent w-24 shrink-0">
                  {format(new Date(p.created_at), 'MMM d')}
                </span>
                <span className="text-sm text-ink truncate flex-1 min-w-0">{p.caption || `(${p.media_type} post)`}</span>
                <span className="text-xs text-muted">
                  {delivered(p).length}/{p.post_targets?.length ?? 0} ✓
                </span>
                {/* A partial target is live, so it counts above — but the
                    reply that failed under it has to be visible somewhere, or
                    the row reads as a clean success. */}
                {partialNote(p) && (
                  <span className="text-xs text-warning" title={partialNote(p)!}>
                    ⚠ reply failed
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
