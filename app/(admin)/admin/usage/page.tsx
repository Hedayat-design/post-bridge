import { loadAdminData } from '@/lib/admin/data'
import { summarizeUsage } from '@/lib/admin/usage'
import { PageHeader } from '@/components/admin/ui/PageHeader'
import { Panel } from '@/components/admin/ui/Panel'
import { Meter } from '@/components/admin/ui/Meter'
import { BarListPanel } from '@/components/admin/ui/BarListPanel'
import { UsageKpis } from '@/components/admin/usage/UsageKpis'
import { DailyUsagePanel } from '@/components/admin/usage/DailyUsagePanel'

/**
 * Admin → AI usage: this month's caption generations against the plan's cap.
 *
 * Numbers: lib/admin/usage.ts. Sections: components/admin/usage/.
 */
export default async function AdminUsage() {
  const data = await loadAdminData()
  const s = summarizeUsage(data)
  const planName = `${data.plan[0].toUpperCase()}${data.plan.slice(1)}`

  return (
    <>
      <PageHeader eyebrow="Admin" title="AI caption usage">
        <p className="text-xs text-faint">
          {s.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · resets on the 1st (UTC)
        </p>
      </PageHeader>

      <Panel
        title="This month’s allowance"
        subtitle={`Failed attempts count: they still cost tokens upstream. ${planName} plan.`}
      >
        <Meter used={s.used} limit={s.limit} label="Generations" />
      </Panel>

      <UsageKpis s={s} />
      <DailyUsagePanel perDay={s.perDay} />

      <div className="grid gap-6 xl:grid-cols-3">
        <BarListPanel title="By platform" rows={s.byPlatform} unit="generations" empty="None yet this month." />
        <BarListPanel title="By model" rows={s.byModel} unit="generations" empty="None yet this month." />
        <BarListPanel title="By member" rows={s.byMember} unit="generations" empty="None yet this month." />
      </div>
    </>
  )
}
