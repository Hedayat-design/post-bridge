import type { AdminData, AdminPost } from '@/lib/admin/data'
import { PLATFORMS, Platform } from '@/lib/platforms'
import {
  countBy,
  dailyOutcomes,
  failureRate,
  lastDays,
  outcomeDate,
  overduePosts,
  totals,
} from '@/lib/admin/stats'

export const platformLabel = (p: string) => PLATFORMS[p as Platform]?.label ?? p

/** Who a post is attributed to, in words. */
export function authorName(createdBy: string | null, memberById: Map<string, { name: string }>) {
  return createdBy ? memberById.get(createdBy)?.name ?? 'Removed member' : 'Before team mode'
}

export type Failure = {
  post: AdminPost
  target: NonNullable<AdminPost['post_targets']>[number]
  when: string
}

/**
 * Every number the Publishing page shows for the last 30 days, computed once
 * from the loaded data. The section components only format what this returns.
 */
export function summarizePublishing({ now, posts, accounts, members }: AdminData) {
  const days30 = lastDays(30, now)
  const firstDay = days30[0]
  const outcomes = dailyOutcomes(posts, days30)
  const total = totals(outcomes)
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const memberById = new Map(members.map((m) => [m.id, m]))

  // Every failed target in the window, newest first, with what it was.
  const failures: Failure[] = posts
    .flatMap((post) =>
      (post.post_targets ?? [])
        .filter((target) => target.status === 'failed')
        .map((target) => ({ post, target, when: outcomeDate(post, target) ?? post.created_at }))
    )
    .filter((f) => f.when.slice(0, 10) >= firstDay)
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))

  return {
    outcomes,
    total,
    rate: failureRate(total.delivered, total.failed),
    failures,
    failuresByPlatform: countBy(failures, (f) => {
      const p = accountById.get(f.target.social_account_id)?.platform
      return p ? platformLabel(p) : 'Disconnected account'
    }),
    scheduled: posts.filter(
      (p) => p.status === 'scheduled' && p.scheduled_for && Date.parse(p.scheduled_for) > now.getTime()
    ),
    overdue: overduePosts(posts, now).sort((a, b) => Date.parse(a.scheduled_for!) - Date.parse(b.scheduled_for!)),
    postsByMember: countBy(
      posts.filter((p) => p.created_at.slice(0, 10) >= firstDay),
      (p) => authorName(p.created_by, memberById)
    ),
    accountById,
    memberById,
  }
}

export type PublishingSummary = ReturnType<typeof summarizePublishing>
