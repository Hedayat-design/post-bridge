import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Post Bridge — Post everywhere from one place',
  description: 'Post and schedule your content to all social platforms at once.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
