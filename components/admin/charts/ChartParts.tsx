import { compact } from '@/lib/admin/stats'

/**
 * Pieces both column charts share, so the two can never drift apart.
 *
 * Chart specs (from the dataviz method): hairline solid gridlines, clean
 * round ticks, columns at most 24px with a 4px rounded data end and a square
 * baseline, tooltips on hover and keyboard focus.
 */

/** "Oct 17" for a UTC day key. */
export function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Horizontal gridlines with their tick labels, plus a message when empty. */
export function YGrid({ ticks, empty }: { ticks: number[]; empty?: string }) {
  const top = ticks[ticks.length - 1]
  return (
    <>
      {empty && (
        <p className="absolute inset-0 left-9 flex items-center justify-center text-sm text-muted">{empty}</p>
      )}
      {ticks.map((t) => (
        <div key={t} aria-hidden className="absolute left-9 right-0 border-t border-hairline/70" style={{ bottom: `${(t / top) * 100}%` }}>
          <span className="absolute -left-9 -translate-y-1/2 pr-2 text-[10px] tabular-nums text-faint">{compact(t)}</span>
        </div>
      ))}
    </>
  )
}

/**
 * Day labels under the columns, counted back from today so the last two
 * never crowd each other: about four labels whatever the range.
 */
export function DayAxis({ days }: { days: string[] }) {
  const every = days.length > 10 ? Math.ceil(days.length / 4) : 1
  return (
    <div className="mt-2 flex pl-9 text-[10px] text-faint">
      {days.map((day, i) => (
        <span key={day} className="flex-1 text-center">
          {(days.length - 1 - i) % every === 0 ? dayLabel(day) : ''}
        </span>
      ))}
    </div>
  )
}

/** Keeps a column's tooltip inside the chart at both ends. */
export function tooltipAlign(index: number, count: number) {
  return index > count - 4 ? 'right-0' : index < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2'
}

/** The faint wash behind the hovered or focused column. */
export function ActiveBand() {
  return <span aria-hidden className="absolute inset-y-0 inset-x-0.5 rounded-md bg-ink/[0.04]" />
}
