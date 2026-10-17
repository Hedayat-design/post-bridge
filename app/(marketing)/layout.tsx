import { MarketingNav } from '@/components/site/MarketingNav'
import { SiteFooter } from '@/components/site/SiteFooter'

/**
 * The public pages: landing, pricing, log in, sign up.
 *
 * Grouped so they can share the signed-out nav, which reads no session and so
 * leaves these routes statically prerendered. A visitor who is not signed in
 * does not need a session lookup to be told where the login page is, and the
 * auth-aware nav in the root layout was costing all four pages their CDN
 * caching to show them the same bar.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
