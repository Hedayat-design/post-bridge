import Link from 'next/link'
import { SiteMark } from '@/components/site/SiteMark'

/**
 * The chrome both navs share: the sticky bar, the mark on the left, and an
 * optional second row the signed-in nav uses below the large breakpoint,
 * where its links no longer fit on one line.
 *
 * The two variants exist because this sits above every page: the signed-out
 * one reads no session, which is what lets the marketing routes prerender.
 */
export function NavShell({
  markHref,
  children,
  mobileRow,
}: {
  markHref: string
  children: React.ReactNode
  mobileRow?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/85 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link href={markHref} className="flex items-center gap-2.5 shrink-0">
          <SiteMark />
        </Link>
        {children}
      </nav>

      {mobileRow && (
        <div className="lg:hidden border-t border-hairline px-6 py-2 flex gap-1 overflow-x-auto">
          {mobileRow}
        </div>
      )}
    </header>
  )
}
