import Link from 'next/link'
import { loadAdminData } from '@/lib/admin/data'
import { summarizeOverview } from '@/lib/admin/overview'
import { PageHeader } from '@/components/admin/ui/PageHeader'
import { LoadErrors } from '@/components/admin/ui/LoadErrors'
import { OverviewKpis } from '@/components/admin/overview/OverviewKpis'
import { OutcomesPanel } from '@/components/admin/publishing/OutcomesPanel'
import { CaptionsPanel } from '@/components/admin/overview/CaptionsPanel'
import { UpcomingPanel } from '@/components/admin/overview/UpcomingPanel'
import { RecentActivityPanel } from '@/components/admin/overview/RecentActivityPanel'

/**
 * Admin → Overview: the headline numbers, the last two weeks of publishing,
 * what is about to go out, and what the team has been doing.
 *
 * Numbers: lib/admin/overview.ts. Sections: components/admin/overview/.
 */
export default async function AdminOverview() {
  const data = await loadAdminData()
  const s = summarizeOverview(data)

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview">
        <p className="text-xs text-faint">
          Updated {data.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
        </p>
      </PageHeader>
      <LoadErrors errors={data.errors} />

      <OverviewKpis s={s} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <OutcomesPanel
          data={s.outcomes14}
          title="Publishing, last 14 days"
          subtitle="Each bar is one day (UTC): posts delivered to an account, and posts that failed."
          action={
            <Link href="/admin/publishing" className="text-xs font-medium text-accent hover:underline">
              Details →
            </Link>
          }
        />
        <CaptionsPanel captions={s.captions} plan={data.plan} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <UpcomingPanel upcoming={s.upcoming} data={data} />
        <RecentActivityPanel items={data.activity} now={data.now} />
      </div>
    </>
  )
}
