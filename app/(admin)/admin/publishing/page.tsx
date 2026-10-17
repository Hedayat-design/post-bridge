import { loadAdminData } from '@/lib/admin/data'
import { summarizePublishing } from '@/lib/admin/publishing'
import { PageHeader } from '@/components/admin/ui/PageHeader'
import { BarListPanel } from '@/components/admin/ui/BarListPanel'
import { PublishingKpis } from '@/components/admin/publishing/PublishingKpis'
import { OverduePanel } from '@/components/admin/publishing/OverduePanel'
import { OutcomesPanel } from '@/components/admin/publishing/OutcomesPanel'
import { FailuresTable } from '@/components/admin/publishing/FailuresTable'

/**
 * Admin → Publishing: the last 30 days of what went out and what didn't, and why.
 *
 * Numbers: lib/admin/publishing.ts. Sections: components/admin/publishing/.
 */
export default async function AdminPublishing() {
  const data = await loadAdminData()
  const s = summarizePublishing(data)

  return (
    <>
      <PageHeader eyebrow="Admin" title="Publishing" />
      <PublishingKpis s={s} />
      <OverduePanel overdue={s.overdue} memberById={s.memberById} now={data.now} />
      <OutcomesPanel data={s.outcomes} title="Delivered and failed, last 30 days" subtitle="Per account, per day (UTC)" />

      <div className="grid gap-6 xl:grid-cols-2">
        <BarListPanel
          title="Failures by platform"
          subtitle="Last 30 days"
          rows={s.failuresByPlatform}
          unit="failures"
          empty="No failures in the last 30 days."
        />
        <BarListPanel
          title="Posts by member"
          subtitle="Created in the last 30 days"
          rows={s.postsByMember}
          unit="posts"
          empty="No posts in the last 30 days."
        />
      </div>

      <FailuresTable s={s} now={data.now} />
    </>
  )
}
