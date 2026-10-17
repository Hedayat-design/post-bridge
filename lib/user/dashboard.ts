import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * What the user dashboard shows: plan, connected-account count, the queue of
 * scheduled posts and the last ten that went live. Server-only; runs as the
 * signed-in user (or the team-mode workspace), so RLS scopes every row.
 */

export type ScheduledPost = { id: string; caption: string | null; scheduled_for: string | null; media_type: string | null }
export type LivePost = {
  id: string
  caption: string | null
  created_at: string
  media_type: string | null
  post_targets: { status: string; error_message: string | null }[] | null
}

export async function loadUserDashboard() {
  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const [profile, accounts, scheduled, live] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', userId).single(),
    supabase.from('social_accounts').select('id').eq('user_id', userId),
    supabase
      .from('posts')
      .select('id, caption, scheduled_for, media_type')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true }),
    supabase
      .from('posts')
      .select('id, caption, created_at, media_type, post_targets(status, error_message)')
      .eq('user_id', userId)
      .eq('status', 'posted')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    plan: (profile.data?.plan as string | undefined) ?? 'free',
    accountCount: accounts.data?.length ?? 0,
    scheduled: (scheduled.data ?? []) as ScheduledPost[],
    live: (live.data ?? []) as LivePost[],
  }
}

/**
 * A target that published but lost a reply underneath it still went out, so
 * it counts as delivered; see the 'partial' status in supabase/schema.sql.
 */
export function deliveredTargets(post: LivePost) {
  return (post.post_targets ?? []).filter((t) => t.status === 'posted' || t.status === 'partial')
}

/** The reply failure under a partial target, if any — so a partial never reads as clean. */
export function partialNote(post: LivePost): string | null {
  return (post.post_targets ?? []).find((t) => t.status === 'partial')?.error_message ?? null
}
