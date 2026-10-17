import { cache } from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { adapters } from '@/lib/adapters'
import { MEMBER_COLUMNS, Member } from '@/lib/team/access'
import { monthStart } from '@/lib/ai/quota'
import { AccountHealth, DAY_MS, PostRow, TargetRow, accountHealth } from '@/lib/admin/stats'

/**
 * Everything the admin dashboard reads, in one round of parallel queries.
 *
 * Server-only. Runs as the workspace's own session, so RLS scopes every row —
 * nothing here filters by user id. A workspace is small enough that loading
 * the last 60 days and computing in memory beats a dozen aggregate queries,
 * and keeps every number defined once, in lib/admin/stats.ts.
 *
 * Tokens never leave this file: an account's refresh token is reduced to a
 * boolean before anything is returned.
 */

export const WINDOW_DAYS = 60

export type AdminPost = Omit<PostRow, 'post_targets'> & {
  id: string
  caption: string | null
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed'
  created_by: string | null
  post_targets: (TargetRow & { error_message: string | null; social_account_id: string })[] | null
}

export type AdminAccount = {
  id: string
  platform: string
  display_name: string | null
  platform_account_id: string
  has_x_premium: boolean
  connected_at: string | null
  token_expires_at: string | null
  health: AccountHealth
}

export type Generation = {
  platform: string
  model: string
  succeeded: boolean
  created_at: string
  created_by: string | null
}

export type Activity = {
  id: string
  member_id: string | null
  member_name: string | null
  action: string
  detail: Record<string, unknown>
  created_at: string
}

export const loadAdminData = cache(async () => {
  const supabase = supabaseServer()
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString()

  const [members, posts, accounts, generations, profile, activity] = await Promise.all([
    supabase.from('team_members').select(MEMBER_COLUMNS).order('created_at'),
    supabase
      .from('posts')
      .select(
        'id, caption, status, scheduled_for, created_at, created_by, post_targets(status, posted_at, error_message, social_account_id)'
      )
      .or(`created_at.gte.${since},scheduled_for.gte.${since}`)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('social_accounts')
      .select(
        'id, platform, display_name, platform_account_id, has_x_premium, connected_at, token_expires_at, refresh_token'
      )
      .order('connected_at'),
    supabase
      .from('caption_generations')
      .select('platform, model, succeeded, created_at, created_by')
      .gte('created_at', monthStart(now).toISOString())
      .limit(10000),
    supabase.from('profiles').select('plan').maybeSingle(),
    supabase
      .from('team_activity')
      .select('id, member_id, member_name, action, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const safeAccounts: AdminAccount[] = (accounts.data ?? []).map((a) => {
    // Same rule lib/tokens.ts applies at publish time.
    const canRenew = Boolean(a.refresh_token) && Boolean(adapters[a.platform]?.refreshToken)
    return {
      id: a.id,
      platform: a.platform,
      display_name: a.display_name,
      platform_account_id: a.platform_account_id,
      has_x_premium: a.has_x_premium ?? false,
      connected_at: a.connected_at,
      token_expires_at: a.token_expires_at,
      health: accountHealth(a.token_expires_at, canRenew, now),
    }
  })

  return {
    now,
    members: (members.data ?? []) as Member[],
    posts: (posts.data ?? []) as AdminPost[],
    accounts: safeAccounts,
    generations: (generations.data ?? []) as Generation[],
    plan: (profile.data?.plan as string | undefined) ?? 'free',
    activity: (activity.data ?? []) as Activity[],
    errors: [members, posts, accounts, generations, activity]
      .map((r) => r.error?.message)
      .filter((m): m is string => Boolean(m)),
  }
})

export type AdminData = Awaited<ReturnType<typeof loadAdminData>>
