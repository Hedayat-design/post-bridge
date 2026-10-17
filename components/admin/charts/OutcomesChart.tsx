'use client'

import { useState } from 'react'
import { niceTicks } from '@/lib/admin/stats'
import { VIZ } from '@/components/admin/ui/viz'
import { ActiveBand, DayAxis, YGrid, dayLabel, tooltipAlign } from '@/components/admin/charts/ChartParts'

type Day = { day: string; delivered: number; failed: number }

/**
 * Delivered vs failed per day, as stacked columns with a 2px surface gap
 * between the two. Two series, so it carries a legend; every value is also in
 * the tooltip and in the TableView the page puts under it.
 */
export function OutcomesChart({ data }: { data: Day[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(0, ...data.map((d) => d.delivered + d.failed))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <LegendKey color={VIZ.delivered} label="Delivered" />
        <LegendKey color={VIZ.failed} label="Failed" />
      </div>

      <div className="relative h-52 pl-9" onPointerLeave={() => setActive(null)}>
        <YGrid ticks={ticks} empty={max === 0 ? 'Nothing was delivered or failed in this period.' : undefined} />

        <div className="absolute inset-y-0 left-9 right-0 flex">
          {data.map((d, i) => {
            const total = d.delivered + d.failed
            const isActive = active === i
            return (
              <button
                key={d.day}
                type="button"
                aria-label={`${dayLabel(d.day)}: ${d.delivered} delivered, ${d.failed} failed`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="relative flex h-full flex-1 items-end justify-center outline-none"
              >
                {isActive && <ActiveBand />}
                <span
                  className="relative flex w-full max-w-[24px] flex-col-reverse gap-[2px] px-[3px] transition-[filter]"
                  style={{ height: `${(total / top) * 100}%`, filter: isActive ? 'brightness(1.15)' : undefined }}
                >
                  {d.delivered > 0 && (
                    <span
                      className={`block w-full ${d.failed === 0 ? 'rounded-t-[4px]' : ''}`}
                      style={{ flexGrow: d.delivered, flexBasis: 0, backgroundColor: VIZ.delivered }}
                    />
                  )}
                  {d.failed > 0 && (
                    <span
                      className="block w-full rounded-t-[4px]"
                      style={{ flexGrow: d.failed, flexBasis: 0, backgroundColor: VIZ.failed }}
                    />
                  )}
                </span>

                {isActive && (
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-full z-20 mb-2 w-36 rounded-xl border border-hairline-strong bg-bg/95 p-3 text-left shadow-lift backdrop-blur ${tooltipAlign(i, data.length)}`}
                  >
                    <span className="block text-[11px] text-muted">{dayLabel(d.day)}</span>
                    <TooltipRow color={VIZ.delivered} value={d.delivered} label="Delivered" />
                    <TooltipRow color={VIZ.failed} value={d.failed} label="Failed" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <DayAxis days={data.map((d) => d.day)} />
    </div>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

/** Value first, label second; a short line key, not a box. */
function TooltipRow({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <span className="mt-1.5 flex items-center gap-2">
      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </span>
  )
}
