import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

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
    .select('id, caption, created_at, media_type, post_targets(status)')
    .eq('user_id', session.user.id)
    .eq('status', 'posted')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-black/50">
            {accounts?.length ?? 0} accounts connected · {profile?.plan ?? 'free'} plan
          </p>
        </div>
        <Link href="/compose" className="bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-lg">
          + New post
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Scheduled Posts</h2>
          <div className="space-y-3">
            {(scheduled?.length ?? 0) === 0 && (
              <p className="text-sm text-black/40">Nothing scheduled yet.</p>
            )}
            {scheduled?.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <span className="text-xs font-semibold text-indigo-600 w-28 shrink-0">
                  {p.scheduled_for ? format(new Date(p.scheduled_for), 'MMM d, h:mm a') : '—'}
                </span>
                <span className="text-sm truncate">{p.caption || `(${p.media_type} post)`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Live Posts</h2>
          <div className="space-y-3">
            {(live?.length ?? 0) === 0 && (
              <p className="text-sm text-black/40">Nothing posted yet.</p>
            )}
            {live?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <span className="text-xs font-semibold text-orange-600 w-24 shrink-0">
                  {format(new Date(p.created_at), 'MMM d')}
                </span>
                <span className="text-sm truncate flex-1">{p.caption || `(${p.media_type} post)`}</span>
                <span className="text-xs text-black/40">
                  {p.post_targets?.filter((t: any) => t.status === 'posted').length ?? 0}/{p.post_targets?.length ?? 0} ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
