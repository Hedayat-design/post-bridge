import { loadUserDashboard } from '@/lib/user/dashboard'
import { allows, getAccess } from '@/lib/team/access'
import { DashboardHeader } from '@/components/user/dashboard/DashboardHeader'
import { ScheduledPanel } from '@/components/user/dashboard/ScheduledPanel'
import { LivePanel } from '@/components/user/dashboard/LivePanel'

/**
 * The user dashboard — what is queued and what went live.
 *
 * Data: lib/user/dashboard.ts. Sections: components/user/dashboard/.
 * The admin dashboard is a separate site: app/(admin)/admin.
 */
export default async function DashboardPage() {
  const [data, access] = await Promise.all([loadUserDashboard(), getAccess()])

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <DashboardHeader accountCount={data.accountCount} plan={data.plan} canPost={allows(access, 'post')} />
      <div className="grid gap-6 md:grid-cols-2">
        <ScheduledPanel posts={data.scheduled} />
        <LivePanel posts={data.live} />
      </div>
    </div>
  )
}
