import { captionLimitFor } from '@/lib/ai/quota'
import type { AdminData } from '@/lib/admin/data'
import {
  DAY_MS,
  dailyOutcomes,
  failureRate,
  lastDays,
  needsAttention,
  overduePosts,
  totals,
} from '@/lib/admin/stats'

/**
 * Every number the Overview page shows, computed once from the loaded data.
 * The section components only format what this returns.
 */
export function summarizeOverview({ now, members, posts, accounts, generations, plan }: AdminData) {
  const days60 = lastDays(60, now)
  const last30 = totals(dailyOutcomes(posts, days60.slice(30)))
  const prev30 = totals(dailyOutcomes(posts, days60.slice(0, 30)))

  const weekAhead = now.getTime() + 7 * DAY_MS
  const upcoming = posts
    .filter((p) => p.status === 'scheduled' && p.scheduled_for)
    .filter((p) => {
      const t = Date.parse(p.scheduled_for!)
      return t >= now.getTime() - 60_000 && t <= weekAhead
    })
    .sort((a, b) => Date.parse(a.scheduled_for!) - Date.parse(b.scheduled_for!))

  const active = members.filter((m) => m.status === 'active')

  return {
    outcomes14: dailyOutcomes(posts, lastDays(14, now)),
    last30,
    deliveredDelta: last30.delivered - prev30.delivered,
    rate30: failureRate(last30.delivered, last30.failed),
    upcoming,
    overdue: overduePosts(posts, now),
    activeMembers: active.length,
    suspendedMembers: members.length - active.length,
    managers: members.filter((m) => m.role === 'owner' || m.role === 'admin').length,
    accountsTotal: accounts.length,
    accountsNeedingAttention: accounts.filter((a) => needsAttention(a.health)).length,
    captions: {
      used: generations.length,
      limit: captionLimitFor(plan),
      succeeded: generations.filter((g) => g.succeeded).length,
      failed: generations.filter((g) => !g.succeeded).length,
    },
  }
}

export type OverviewSummary = ReturnType<typeof summarizeOverview>
