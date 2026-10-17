import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { MockBanner } from '@/components/site/MockBanner'
import { TeamModeBanner } from '@/components/site/TeamModeBanner'

/**
 * globals.css asked for Inter and never loaded it, so every page was actually
 * rendering in the system font. Loading both here through next/font means
 * they are self-hosted and preloaded — no layout shift, no request to Google
 * at render time.
 *
 * Playfair for display only: a serif headline over a sans body is what makes
 * the palette read as luxury rather than as a dashboard that happens to be
 * navy.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Post Bridge — Post everywhere from one place',
  description: 'Post and schedule your content to all social platforms at once.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      {/* Flex column with a growing main, so a short page still pins the
          footer to the bottom instead of floating it mid-screen. Each site
          brings its own chrome: (marketing) the public nav, (user) the user
          nav and footer, (admin) the admin top bar and sidebar. See
          docs/CODE-MAP.md. */}
      <body className="min-h-screen flex flex-col">
        <MockBanner />
        <TeamModeBanner />
        {children}
      </body>
    </html>
  )
}
