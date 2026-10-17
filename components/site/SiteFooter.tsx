import Link from 'next/link'
import { SiteMark } from '@/components/site/SiteMark'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/compose', label: 'Compose' },
      { href: '/styles', label: 'Caption styles' },
      { href: '/connect', label: 'Connected accounts' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Platforms',
    links: [
      { href: '/connect', label: 'X' },
      { href: '/connect', label: 'LinkedIn' },
      { href: '/connect', label: 'Instagram' },
      { href: '/connect', label: 'TikTok' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline mt-24">
      <div className="max-w-6xl mx-auto px-6 py-14 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-3">
            <SiteMark size="sm" />
          </div>
          <p className="text-sm text-muted max-w-xs">
            Upload once. Every platform gets a post written in your voice, for
            its own audience.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-accent mb-3">
              {column.heading}
            </p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} Post Bridge. All rights reserved.
          </p>
          <p className="text-xs tracking-[0.18em] uppercase text-accent">
            Bold in colour · Rich in style
          </p>
        </div>
      </div>
    </footer>
  )
}
