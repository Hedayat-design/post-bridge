import { createBrowserClient } from '@supabase/ssr'

// Use in Client Components.
// This is deliberately a separate module from ./server: that one imports
// next/headers, which cannot be bundled into client code.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
