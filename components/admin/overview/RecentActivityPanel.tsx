import Link from 'next/link'
import { Panel } from '@/components/admin/ui/Panel'
import { ActivityFeed } from '@/components/admin/activity/ActivityFeed'
import type { Activity } from '@/lib/admin/data'

/** The last few things the team did; the full log is on the Team page. */
export function RecentActivityPanel({ items, now }: { items: Activity[]; now: Date }) {
  return (
    <Panel
      title="Recent activity"
      action={
        <Link href="/admin/team" className="text-xs font-medium text-accent hover:underline">
          Team →
        </Link>
      }
    >
      <ActivityFeed items={items.slice(0, 7)} now={now} />
    </Panel>
  )
}
