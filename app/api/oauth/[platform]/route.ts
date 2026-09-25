import { NextRequest, NextResponse } from 'next/server'
import { PLATFORMS, Platform } from '@/lib/platforms'
import { supabaseServer } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform as Platform
  const config = PLATFORMS[platform]
  if (!config) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId = process.env[config.clientIdEnv]
  const redirectUri = `${request.nextUrl.origin}/api/oauth/${platform}/callback`

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', clientId ?? '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', config.scope)
  authUrl.searchParams.set('response_type', 'code')
  // state carries the logged-in user's id through the redirect so the callback
  // knows whose social_accounts row to create
  authUrl.searchParams.set('state', session.user.id)

  return NextResponse.redirect(authUrl.toString())
}
