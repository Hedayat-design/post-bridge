import { Panel } from '@/components/admin/ui/Panel'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { DataTable } from '@/components/admin/ui/DataTable'
import { HealthBadge } from '@/components/admin/ui/HealthBadge'
import { needsAttention, relativeTime } from '@/lib/admin/stats'
import { platformLabel } from '@/lib/admin/publishing'
import type { AdminAccount } from '@/lib/admin/data'

/** Every connected account, the ones to act on first. Tokens are never shown. */
export function AccountsTable({ accounts, now }: { accounts: AdminAccount[]; now: Date }) {
  const rows = [...accounts].sort(
    (a, b) => Number(needsAttention(b.health)) - Number(needsAttention(a.health)) || a.platform.localeCompare(b.platform)
  )

  return (
    <Panel title="Accounts" subtitle="Tokens that can renew themselves are never flagged">
      {rows.length === 0 ? (
        <EmptyState>No accounts connected yet.</EmptyState>
      ) : (
        <DataTable
          minWidth={680}
          head={
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-4 py-3 font-medium">Connected</th>
            </tr>
          }
        >
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-hairline">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">
                  {a.display_name ?? a.platform_account_id}
                  {a.platform === 'x' && a.has_x_premium && (
                    <span className="ml-2 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                      Premium
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">{platformLabel(a.platform)}</p>
              </td>
              <td className="px-4 py-3">
                <HealthBadge health={a.health} />
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {a.token_expires_at
                  ? `${Date.parse(a.token_expires_at) < now.getTime() ? 'Expired' : 'Expires'} ${relativeTime(a.token_expires_at, now)}`
                  : 'No expiry'}
              </td>
              <td className="px-4 py-3 text-xs text-muted">{relativeTime(a.connected_at, now)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  )
}
