import Link from 'next/link'
import { NavShell } from '@/components/site/NavShell'

/**
 * The signed-out nav, used by the (marketing) group.
 *
 * Deliberately reads no session: a visitor on the landing or pricing page is
 * shown the same bar either way, so a session lookup here would buy nothing
 * and would opt those routes out of static rendering.
 */
export function MarketingNav() {
  return (
    <NavShell markHref="/">
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/pricing"
          className="hidden sm:block px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Pricing
        </Link>
        <Link
          href="/login"
          className="px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="bg-primary text-primary-fg text-sm font-semibold px-4 py-2 rounded-full transition-colors hover:bg-primary-hover"
        >
          Try it free
        </Link>
      </div>
    </NavShell>
  )
}
