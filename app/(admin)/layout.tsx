import { RoleGate } from '@/components/team/RoleGate'
import { AdminTopBar } from '@/components/admin/shell/AdminTopBar'
import { AdminSidebar } from '@/components/admin/shell/AdminSidebar'
import { requirePickedMember } from '@/lib/team/guards'

/**
 * The admin site — a separate site from the user one (app/(user)), with its
 * own top bar and section sidebar and no user nav or footer. Owners and
 * admins only; always in the brand's dark register (.force-dark).
 *
 * Pages live in app/(admin)/admin/*; their sections in components/admin/*.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePickedMember()
  const member = access.teamMode ? access.member : null

  return (
    <div className="force-dark flex flex-1 flex-col">
      <AdminTopBar member={member} />
      <RoleGate need="view_admin">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-6 pb-16 pt-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:pt-12">
          <AdminSidebar />
          <main className="min-w-0 space-y-6">{children}</main>
        </div>
      </RoleGate>
    </div>
  )
}
