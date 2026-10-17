import Link from 'next/link'
import { allows, getAccess, refusal } from '@/lib/team/access'
import { Action } from '@/lib/team/roles'

/**
 * Wraps a page that needs a role. Used from route layouts, so the client
 * pages underneath (compose, styles) need no changes; the API routes behind
 * them check again, because a page can be skipped and a request cannot.
 */
export async function RoleGate({ need, children }: { need: Action; children: React.ReactNode }) {
  const access = await getAccess()
  if (allows(access, need)) return <>{children}</>

  return (
    <div className="mx-auto max-w-xl px-6 py-28 text-center">
      <span className="mx-auto block h-10 w-10 rounded-full border border-accent/40" />
      <h1 className="font-display mt-6 text-3xl font-bold text-ink">Not with this role</h1>
      <p className="mt-4 leading-relaxed text-muted">{refusal(access, need)}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Back to dashboard
        </Link>
        <Link
          href="/who"
          className="rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Switch person
        </Link>
      </div>
    </div>
  )
}
