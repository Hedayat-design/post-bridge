'use client'

import { useState } from 'react'
import { niceTicks } from '@/lib/admin/stats'
import { VIZ } from '@/components/admin/ui/viz'
import { ActiveBand, DayAxis, YGrid, dayLabel, tooltipAlign } from '@/components/admin/charts/ChartParts'

/**
 * One series per day as columns. No legend: the panel's title names the
 * series. Hover or focus a column for its value.
 */
export function DailyColumns({ data, unit }: { data: { day: string; value: number }[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]

  return (
    <div>
      <div className="relative h-40 pl-9" onPointerLeave={() => setActive(null)}>
        <YGrid ticks={ticks} empty={max === 0 ? 'None yet in this period.' : undefined} />
        <div className="absolute inset-y-0 left-9 right-0 flex">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${dayLabel(d.day)}: ${d.value} ${unit}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="relative flex h-full flex-1 items-end justify-center outline-none"
            >
              {active === i && <ActiveBand />}
              <span className="relative block w-full max-w-[24px] rounded-t-[4px] px-[3px]" style={{ height: `${(d.value / top) * 100}%` }}>
                <span
                  className="block h-full w-full rounded-t-[4px]"
                  style={{ backgroundColor: VIZ.magnitude, filter: active === i ? 'brightness(1.2)' : undefined }}
                />
              </span>
              {active === i && (
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full z-20 mb-2 whitespace-nowrap rounded-xl border border-hairline-strong bg-bg/95 px-3 py-2 text-left shadow-lift backdrop-blur ${tooltipAlign(i, data.length)}`}
                >
                  <span className="block text-[11px] text-muted">{dayLabel(d.day)}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{d.value}</span>{' '}
                  <span className="text-xs text-muted">{unit}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <DayAxis days={data.map((d) => d.day)} />
    </div>
  )
}
