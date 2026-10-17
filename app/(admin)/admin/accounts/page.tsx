import Link from 'next/link'
import { loadAdminData } from '@/lib/admin/data'
import { countBy } from '@/lib/admin/stats'
import { platformLabel } from '@/lib/admin/publishing'
import { PageHeader } from '@/components/admin/ui/PageHeader'
import { BarListPanel } from '@/components/admin/ui/BarListPanel'
import { AccountsKpis } from '@/components/admin/accounts/AccountsKpis'
import { AccountsTable } from '@/components/admin/accounts/AccountsTable'

/** Admin → Accounts: every connected social account and whether it can still publish. */
export default async function AdminAccounts() {
  const { now, accounts, plan } = await loadAdminData()

  return (
    <>
      <PageHeader eyebrow="Admin" title="Connected accounts">
        <Link
          href="/connect"
          className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Connect an account →
        </Link>
      </PageHeader>
      <AccountsKpis accounts={accounts} plan={plan} />
      <AccountsTable accounts={accounts} now={now} />
      {accounts.length > 0 && (
        <BarListPanel
          title="Accounts by platform"
          rows={countBy(accounts, (a) => platformLabel(a.platform))}
          unit="accounts"
          empty="No accounts connected yet."
        />
      )}
    </>
  )
}
