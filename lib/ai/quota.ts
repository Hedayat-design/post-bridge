/**
 * Monthly caption-generation caps.
 *
 * Generation is billed to the app's own OpenRouter key, so without a ceiling
 * one user in a retry loop spends real money with nothing to stop them. The
 * cap is enforced by counting rows in `caption_generations` for the current
 * month rather than by keeping a counter, so it cannot drift away from what
 * was actually spent.
 *
 * Failed attempts count. A refused or timed-out call still costs tokens
 * upstream, and excluding them would make a broken model slug a free
 * unlimited loop.
 */

/** Generations per calendar month, by plan. Mirrors PLAN_LIMITS in lib/platforms.ts. */
export const CAPTION_LIMITS: Record<string, number> = {
  free: 15,
  starter: 300,
  creator: 1000,
  pro: Infinity,
}

export function captionLimitFor(plan: string | null | undefined): number {
  return CAPTION_LIMITS[plan ?? 'free'] ?? CAPTION_LIMITS.free
}

/**
 * Start of the current month in UTC.
 *
 * UTC rather than the user's zone so the window cannot be reset by changing
 * a timezone, and so the boundary matches what the database stores.
 */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export type QuotaState = {
  used: number
  limit: number
  remaining: number
  exceeded: boolean
}

export function quotaState(used: number, plan: string | null | undefined): QuotaState {
  const limit = captionLimitFor(plan)
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
  return { used, limit, remaining, exceeded: used >= limit }
}

/**
 * The message shown when someone runs out. Names the number they hit and the
 * way out, because "quota exceeded" with no number invites a support ticket.
 */
export function quotaMessage(state: QuotaState, plan: string): string {
  return `You have used all ${state.limit} caption generations on the ${plan} plan this month. Upgrade for more, or write captions by hand.`
}
