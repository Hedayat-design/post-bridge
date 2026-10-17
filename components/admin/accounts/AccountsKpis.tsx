import { StatTile } from '@/components/admin/ui/StatTile'
import { needsAttention } from '@/lib/admin/stats'
import { PLAN_LIMITS } from '@/lib/platforms'
import type { AdminAccount } from '@/lib/admin/data'

export function AccountsKpis({ accounts, plan }: { accounts: AdminAccount[]; plan: string }) {
  const attention = accounts.filter((a) => needsAttention(a.health)).length
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile
        label="Connected"
        value={String(accounts.length)}
        context={Number.isFinite(limit) ? `${limit} allowed on the ${plan} plan` : `No limit on the ${plan} plan`}
      />
      <StatTile
        label="Needing attention"
        value={String(attention)}
        tone={attention > 0 ? 'attention' : 'default'}
        context={attention > 0 ? 'Will fail to publish until reconnected' : 'Every account can publish'}
      />
      <StatTile
        label="Platforms"
        value={String(new Set(accounts.map((a) => a.platform)).size)}
        context="With at least one account"
      />
    </div>
  )
}
