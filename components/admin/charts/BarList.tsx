'use client'

import { useState } from 'react'
import { VIZ } from '@/components/admin/ui/viz'

/**
 * Horizontal bars for one series over unordered categories, all one colour —
 * a value ramp would double-encode length as hue. The value sits at the bar's
 * tip, so nothing hides behind hover; hover and focus only highlight.
 */
export function BarList({ rows, unit }: { rows: { label: string; value: number; note?: string }[]; unit: string }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3" onPointerLeave={() => setActive(null)}>
      {rows.map((r) => (
        <li
          key={r.label}
          tabIndex={0}
          aria-label={`${r.label}: ${r.value} ${unit}${r.note ? `, ${r.note}` : ''}`}
          onPointerEnter={() => setActive(r.label)}
          onFocus={() => setActive(r.label)}
          onBlur={() => setActive(null)}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-ink/90">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-ink">{r.value.toLocaleString('en-US')}</span>
              {r.note && <span className="ml-1.5">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2.5">
            <div
              className="h-full rounded-r-[4px] transition-[filter]"
              style={{
                width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%`,
                backgroundColor: VIZ.magnitude,
                filter: active === r.label ? 'brightness(1.2)' : undefined,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
