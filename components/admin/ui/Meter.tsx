import { VIZ } from '@/components/admin/ui/viz'

/**
 * A ratio against a limit. The track is the fill's own hue, dimmed, so the
 * whole bar reads as one quantity; the numbers are always printed beside it.
 * Turns red once the limit is reached.
 */
export function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = !Number.isFinite(limit)
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(1, limit))
  const over = !unlimited && used >= limit
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-ink">
          {used.toLocaleString('en-US')} {unlimited ? '· no cap' : `of ${limit.toLocaleString('en-US')}`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit}
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: VIZ.track }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${unlimited ? 0 : Math.max(ratio * 100, used > 0 ? 2 : 0)}%`,
            backgroundColor: over ? VIZ.failed : VIZ.magnitude,
          }}
        />
      </div>
    </div>
  )
}
