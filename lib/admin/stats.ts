/**
 * The arithmetic behind the admin dashboard.
 *
 * Pure: the pages fetch rows and hand them here, so every number on the
 * dashboard has one definition and a test. Days are UTC calendar days — the
 * dashboard renders on the server, and a team spread across zones needs one
 * shared answer to "what happened on Tuesday".
 */

export const DAY_MS = 24 * 60 * 60 * 1000

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The last `count` UTC days ending today, oldest first. */
export function lastDays(count: number, now: Date = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: count }, (_, i) => utcDayKey(new Date(today - (count - 1 - i) * DAY_MS)))
}

export type TargetRow = {
  status: 'pending' | 'posted' | 'partial' | 'failed'
  posted_at: string | null
}

export type PostRow = {
  scheduled_for: string | null
  created_at: string
  post_targets: TargetRow[] | null
}

/**
 * When a target's outcome happened. A delivered target has posted_at; a
 * failed one never does, so it is dated when it was due to go out.
 */
export function outcomeDate(post: PostRow, target: TargetRow): string | null {
  if (target.status === 'pending') return null
  return target.posted_at ?? post.scheduled_for ?? post.created_at
}

/** A partial target still went out — the reply under it failed, not the post. */
export function isDelivered(status: TargetRow['status']) {
  return status === 'posted' || status === 'partial'
}

export type DayOutcome = { day: string; delivered: number; failed: number }

export function dailyOutcomes(posts: PostRow[], days: string[]): DayOutcome[] {
  const byDay = new Map(days.map((day) => [day, { day, delivered: 0, failed: 0 }]))
  for (const post of posts) {
    for (const target of post.post_targets ?? []) {
      const when = outcomeDate(post, target)
      if (!when) continue
      const bucket = byDay.get(when.slice(0, 10))
      if (!bucket) continue
      if (isDelivered(target.status)) bucket.delivered++
      else if (target.status === 'failed') bucket.failed++
    }
  }
  return days.map((day) => byDay.get(day)!)
}

export function totals(rows: DayOutcome[]) {
  return rows.reduce(
    (sum, r) => ({ delivered: sum.delivered + r.delivered, failed: sum.failed + r.failed }),
    { delivered: 0, failed: 0 }
  )
}

/** Share of finished targets that failed; null when nothing finished. */
export function failureRate(delivered: number, failed: number): number | null {
  const finished = delivered + failed
  return finished === 0 ? null : failed / finished
}

/** Counts by key, largest first, ties alphabetical so the order is stable. */
export function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/**
 * Scheduled posts whose time has passed by more than `graceMs` but are still
 * marked scheduled: the scheduler has not picked them up. Worth a warning on
 * its own — they are not "upcoming", and they have not failed either.
 */
export function overduePosts<T extends { status: string; scheduled_for: string | null }>(
  posts: T[],
  now: Date = new Date(),
  graceMs = 10 * 60 * 1000
): T[] {
  return posts.filter(
    (p) => p.status === 'scheduled' && p.scheduled_for !== null && Date.parse(p.scheduled_for) < now.getTime() - graceMs
  )
}

export type AccountHealth = 'renews' | 'healthy' | 'expiring' | 'expired'

/**
 * Whether a connected account will still publish. An expired access token is
 * harmless when a refresh token exists and the platform supports refreshing —
 * lib/tokens.ts renews it at publish time — so only accounts that cannot
 * renew are ever flagged.
 */
export function accountHealth(
  expiresAt: string | null,
  canRenew: boolean,
  now: Date = new Date(),
  warnWithinMs = 3 * DAY_MS
): AccountHealth {
  if (canRenew) return 'renews'
  if (!expiresAt) return 'healthy'
  const left = Date.parse(expiresAt) - now.getTime()
  if (left <= 0) return 'expired'
  if (left <= warnWithinMs) return 'expiring'
  return 'healthy'
}

export function needsAttention(health: AccountHealth) {
  return health === 'expired' || health === 'expiring'
}

/** 950 → "950", 1284 → "1,284", 12_900 → "12.9K", 4_200_000 → "4.2M". */
export function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs < 10_000) return value.toLocaleString('en-US')
  if (abs < 1_000_000) return `${trim(value / 1000)}K`
  return `${trim(value / 1_000_000)}M`
}

function trim(n: number) {
  return (Math.round(n * 10) / 10).toString()
}

export function percent(ratio: number | null, digits = 1): string {
  if (ratio === null) return '—'
  const value = ratio * 100
  return `${value === 0 || value === 100 ? value.toFixed(0) : value.toFixed(digits)}%`
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Never'
  const diff = now.getTime() - Date.parse(iso)
  if (diff < 0) return relativeFuture(-diff)
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)} h ago`
  if (diff < 14 * DAY_MS) return `${Math.floor(diff / DAY_MS)} d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function relativeFuture(ms: number): string {
  if (ms < 3_600_000) return `in ${Math.max(1, Math.round(ms / 60_000))} min`
  if (ms < DAY_MS) return `in ${Math.round(ms / 3_600_000)} h`
  return `in ${Math.round(ms / DAY_MS)} d`
}

/** Clean y-axis ticks: 0 and three round steps covering the max. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}
