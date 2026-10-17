import { Panel } from '@/components/admin/ui/Panel'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { BarList } from '@/components/admin/charts/BarList'

/** A titled list of bars, or a plain sentence when there is nothing to count. */
export function BarListPanel({
  title,
  subtitle,
  rows,
  unit,
  empty,
}: {
  title: string
  subtitle?: string
  rows: { label: string; value: number; note?: string }[]
  unit: string
  empty: string
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      {rows.length === 0 ? <EmptyState>{empty}</EmptyState> : <BarList rows={rows} unit={unit} />}
    </Panel>
  )
}
