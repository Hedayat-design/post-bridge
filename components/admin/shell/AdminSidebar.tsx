'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/admin', label: 'Overview', glyph: '◎' },
  { href: '/admin/team', label: 'Team', glyph: '◐' },
  { href: '/admin/publishing', label: 'Publishing', glyph: '↗' },
  { href: '/admin/accounts', label: 'Accounts', glyph: '⌁' },
  { href: '/admin/usage', label: 'AI usage', glyph: '✦' },
]

/** A rail on desktop, a scrolling tab row on a phone. */
export function AdminSidebar() {
  const path = usePathname()
  return (
    <nav aria-label="Admin sections" className="min-w-0 lg:sticky lg:top-24">
      <p className="hidden px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-faint lg:block">
        Admin
      </p>
      <ul className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:mt-3 lg:flex-col lg:overflow-visible lg:px-0">
        {SECTIONS.map((s) => {
          const active = s.href === '/admin' ? path === '/admin' : path.startsWith(s.href)
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-surface text-ink' : 'text-muted hover:bg-surface/60 hover:text-ink'
                }`}
              >
                {active && (
                  <span aria-hidden className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-accent-bright lg:block" />
                )}
                <span aria-hidden className={`w-4 text-center ${active ? 'text-accent' : 'text-faint'}`}>
                  {s.glyph}
                </span>
                {s.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
