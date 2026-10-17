import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { NavShell } from '@/components/site/NavShell'
import { MarketingNav } from '@/components/site/MarketingNav'
import { MemberChip } from '@/components/team/MemberChip'
import { allows, getAccess } from '@/lib/team/access'
import { Action } from '@/lib/team/roles'

/**
 * The user site's nav (the (user) route group).
 *
 * A server component so it can read the session directly and show the working
 * pages without a loading flicker. That read makes every route under it
 * dynamic, which is fine — the user pages are per-user anyway — and is why the
 * marketing routes use {@link MarketingNav} instead.
 *
 * Shows only the pages the acting member's role can use, and — for owners and
 * admins only — a button across to the admin site.
 */
const LINKS: { href: string; label: string; need: Action }[] = [
  { href: '/dashboard', label: 'Dashboard', need: 'view' },
  { href: '/compose', label: 'Compose', need: 'post' },
  { href: '/styles', label: 'Styles', need: 'edit_styles' },
  { href: '/connect', label: 'Accounts', need: 'manage_accounts' },
]

export async function UserNav() {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // The user pages redirect a signed-out visitor to /login, but one can still
  // see this bar for the moment before that happens.
  if (!user) return <MarketingNav />

  const access = await getAccess()
  const links = LINKS.filter((link) => allows(access, link.need))
  const member = access.teamMode ? access.member : null
  const isAdmin = allows(access, 'view_admin')

  return (
    <NavShell
      markHref="/dashboard"
      mobileRow={links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-3 py-1.5 text-sm font-medium text-muted whitespace-nowrap rounded-lg transition-colors hover:text-ink"
        >
          {item.label}
        </Link>
      ))}
    >
      <div className="hidden lg:flex items-center gap-1 ml-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 text-sm font-medium text-muted rounded-lg transition-colors hover:text-ink hover:bg-surface"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/50 px-3.5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
          >
            <span aria-hidden>◎</span>
            <span className="hidden sm:inline">Admin dashboard</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        )}
        {allows(access, 'post') && (
          <Link
            href="/compose"
            className="hidden sm:inline-flex whitespace-nowrap bg-primary text-primary-fg text-sm font-semibold px-4 py-2 rounded-full transition-colors hover:bg-primary-hover"
          >
            New post
          </Link>
        )}
        {member && <MemberChip member={member} />}
      </div>
    </NavShell>
  )
}
