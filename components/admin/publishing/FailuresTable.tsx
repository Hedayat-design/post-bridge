import { Panel } from '@/components/admin/ui/Panel'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { DataTable } from '@/components/admin/ui/DataTable'
import { relativeTime } from '@/lib/admin/stats'
import { platformLabel } from '@/lib/admin/publishing'
import type { PublishingSummary } from '@/lib/admin/publishing'

/** The last 20 failures, each with the platform's own reason, as returned. */
export function FailuresTable({ s, now }: { s: PublishingSummary; now: Date }) {
  return (
    <Panel title="Recent failures" subtitle="The platform’s own reason, as it was returned">
      {s.failures.length === 0 ? (
        <EmptyState>Nothing has failed in the last 30 days.</EmptyState>
      ) : (
        <DataTable
          minWidth={720}
          head={
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Post</th>
            </tr>
          }
        >
          {s.failures.slice(0, 20).map(({ post, target, when }, i) => {
            const account = s.accountById.get(target.social_account_id)
            return (
              <tr key={`${post.id}-${i}`} className="border-t border-hairline align-top">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{relativeTime(when, now)}</td>
                <td className="px-4 py-3 text-xs">
                  <p className="font-medium text-ink">{account ? platformLabel(account.platform) : 'Disconnected'}</p>
                  <p className="text-muted">{account?.display_name ?? account?.platform_account_id ?? '—'}</p>
                </td>
                <td className="max-w-sm px-4 py-3 text-xs text-ink/85">{target.error_message ?? 'No reason given'}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-muted">
                  <p className="line-clamp-2">{post.caption?.trim() || 'No default caption'}</p>
                </td>
              </tr>
            )
          })}
        </DataTable>
      )}
    </Panel>
  )
}
