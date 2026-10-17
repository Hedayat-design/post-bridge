import { VIZ } from '@/components/admin/ui/viz'

/**
 * One headline number. Set in the UI sans (never the display serif) with
 * proportional figures — a serif figure reads as decoration, and tabular
 * digits look loose when large. "attention" adds a red ▲ beside the value;
 * the context line says why, so the colour never carries meaning alone.
 */
export function StatTile({
  label,
  value,
  context,
  tone = 'default',
}: {
  label: string
  value: string
  context?: string
  tone?: 'default' | 'attention'
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-ink">
        {tone === 'attention' && (
          <span aria-hidden className="text-base" style={{ color: VIZ.failed }}>
            ▲
          </span>
        )}
        {value}
      </p>
      {context && <p className="mt-1 text-xs text-faint">{context}</p>}
    </div>
  )
}
