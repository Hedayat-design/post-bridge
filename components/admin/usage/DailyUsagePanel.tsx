import { Panel } from '@/components/admin/ui/Panel'
import { TableView } from '@/components/admin/ui/TableView'
import { DailyColumns } from '@/components/admin/charts/DailyColumns'
import type { UsageSummary } from '@/lib/admin/usage'

export function DailyUsagePanel({ perDay }: { perDay: UsageSummary['perDay'] }) {
  return (
    <Panel title="Generations per day" subtitle="This month, UTC">
      <DailyColumns data={perDay} unit="generations" />
      <TableView head={['Day', 'Generations']} rows={perDay.map((d) => [d.day, d.value])} />
    </Panel>
  )
}
