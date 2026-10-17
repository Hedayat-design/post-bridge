import { Panel } from '@/components/admin/ui/Panel'
import { TableView } from '@/components/admin/ui/TableView'
import { OutcomesChart } from '@/components/admin/charts/OutcomesChart'
import type { DayOutcome } from '@/lib/admin/stats'

/**
 * Delivered vs failed per day, with its table view. Shared by Overview (14
 * days) and Publishing (30 days) so the two always draw the same way.
 */
export function OutcomesPanel({
  data,
  title,
  subtitle,
  action,
}: {
  data: DayOutcome[]
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <Panel title={title} subtitle={subtitle} action={action}>
      <OutcomesChart data={data} />
      <TableView head={['Day', 'Delivered', 'Failed']} rows={data.map((d) => [d.day, d.delivered, d.failed])} />
    </Panel>
  )
}
