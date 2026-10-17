import Link from 'next/link'
import { SiteMark } from '@/components/site/SiteMark'
import { MemberChip } from '@/components/team/MemberChip'
import type { Member } from '@/lib/team/access'

/**
 * The admin site's own top bar — deliberately not the user nav, so it is
 * always obvious which site you are on. "Go to app" crosses back.
 */
export function AdminTopBar({ member }: { member: Member | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
          <SiteMark />
        </Link>
        <span className="rounded-full border border-accent/50 bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Admin
        </span>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline-strong px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <span className="hidden sm:inline">Go to app</span>
            <span className="sm:hidden">App</span>
            <span aria-hidden>→</span>
          </Link>
          {member && <MemberChip member={member} />}
        </div>
      </div>
    </header>
  )
}
