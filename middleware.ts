import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  MEMBER_COOKIE,
  TEAM_MODE_BLOCKED_MESSAGE,
  teamModeState,
  workspaceCredentials,
} from '@/lib/team/mode'

const PROTECTED = ['/dashboard', '/connect', '/compose', '/styles', '/admin', '/pricing/manage']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const mode = teamModeState()
  if (mode === 'blocked') {
    return new NextResponse(TEAM_MODE_BLOCKED_MESSAGE, { status: 503 })
  }

  // Outside team mode these are matched only so team mode can redirect them;
  // they should not pay for a session lookup.
  if (mode === 'off') {
    if (path === '/who') return NextResponse.redirect(new URL('/login', request.url))
    if (path === '/login' || path === '/signup') return NextResponse.next()
  }

  // Cookies Supabase wants to set (a refreshed or new session) are collected
  // and applied to whichever response this returns, redirects included.
  const pending: { name: string; value: string; options: CookieOptions }[] = []
  const finish = (response: NextResponse) => {
    for (const c of pending) response.cookies.set({ name: c.name, value: c.value, ...c.options })
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          pending.push({ name, value, options })
        },
        remove(name: string, options: CookieOptions) {
          pending.push({ name, value: '', options })
        },
      },
    }
  )

  // getUser() revalidates the JWT with Supabase. getSession() only decodes the
  // cookie, so a forged cookie would pass the check below.
  const { data: { user } } = await supabase.auth.getUser()

  if (mode === 'on') {
    // No login screen: the server signs into the shared workspace account,
    // then retries the same URL carrying the new session cookies.
    if (!user) {
      const credentials = workspaceCredentials()
      const retried = request.nextUrl.searchParams.has('ws')
      if (!credentials || retried) {
        return new NextResponse(
          'Team mode could not sign in to the workspace account. Check WORKSPACE_EMAIL and ' +
            'WORKSPACE_PASSWORD in .env.local, and that the account exists in Supabase.',
          { status: 500 }
        )
      }
      const { error } = await supabase.auth.signInWithPassword(credentials)
      if (error) {
        return new NextResponse(`Team mode could not sign in to the workspace account: ${error.message}`, {
          status: 500,
        })
      }
      const retry = request.nextUrl.clone()
      retry.searchParams.set('ws', '1')
      return finish(NextResponse.redirect(retry))
    }

    if (request.nextUrl.searchParams.has('ws')) {
      const clean = request.nextUrl.clone()
      clean.searchParams.delete('ws')
      return finish(NextResponse.redirect(clean))
    }

    if (path === '/login' || path === '/signup') {
      return finish(NextResponse.redirect(new URL('/who', request.url)))
    }

    // Everyone working in the app has said who they are. Whether that person
    // still exists and is active is checked server-side (lib/team/access.ts).
    if (path !== '/who' && !request.cookies.get(MEMBER_COOKIE)?.value) {
      const who = new URL('/who', request.url)
      who.searchParams.set('next', path)
      return finish(NextResponse.redirect(who))
    }

    return finish(NextResponse.next())
  }

  if (PROTECTED.some((p) => path.startsWith(p)) && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', path)
    return finish(NextResponse.redirect(redirectUrl))
  }

  return finish(NextResponse.next())
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/connect/:path*',
    '/compose/:path*',
    '/styles/:path*',
    '/admin/:path*',
    '/pricing/manage/:path*',
    // Only redirected in team mode; matched always because the matcher is static.
    '/who',
    '/login',
    '/signup',
  ],
}
