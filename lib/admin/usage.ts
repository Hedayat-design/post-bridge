import type { AdminData } from '@/lib/admin/data'
import { captionLimitFor, monthStart } from '@/lib/ai/quota'
import { countBy, lastDays, utcDayKey } from '@/lib/admin/stats'
import { platformLabel } from '@/lib/admin/publishing'

/**
 * Every number the AI usage page shows for this calendar month (UTC),
 * computed once. Failed generations count against the allowance: they still
 * cost tokens upstream.
 */
export function summarizeUsage({ now, generations, plan, members }: AdminData) {
  const start = monthStart(now)
  const succeeded = generations.filter((g) => g.succeeded).length
  const memberById = new Map(members.map((m) => [m.id, m.name]))
  const days = lastDays(now.getUTCDate(), now).filter((d) => d >= utcDayKey(start))

  return {
    start,
    limit: captionLimitFor(plan),
    used: generations.length,
    succeeded,
    failed: generations.length - succeeded,
    perDay: days.map((day) => ({ day, value: generations.filter((g) => g.created_at.slice(0, 10) === day).length })),
    byPlatform: countBy(generations, (g) => platformLabel(g.platform)),
    byModel: countBy(generations, (g) => g.model).map((row) => {
      const fails = generations.filter((g) => g.model === row.label && !g.succeeded).length
      return { ...row, note: fails ? `${fails} failed` : undefined }
    }),
    byMember: countBy(generations, (g) =>
      g.created_by ? memberById.get(g.created_by) ?? 'Removed member' : 'Before team mode'
    ),
  }
}

export type UsageSummary = ReturnType<typeof summarizeUsage>
