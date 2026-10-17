import { UserNav } from '@/components/user/nav/UserNav'
import { SiteFooter } from '@/components/site/SiteFooter'
import { requirePickedMember } from '@/lib/team/guards'

/**
 * The user site: dashboard, compose, caption styles, connected accounts.
 *
 * Its own nav (UserNav) and the shared footer. The admin site is a separate
 * route group, app/(admin), with its own shell — the two only meet through
 * the "Admin dashboard" / "Go to app" buttons.
 *
 * The nav's session read makes these pages dynamic, which costs nothing —
 * each one already reads the signed-in user's own data.
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  await requirePickedMember()

  return (
    <>
      <UserNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
