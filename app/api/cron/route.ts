import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Configure in vercel.json to hit this every minute, e.g.:
// { "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
// Vercel sends a bearer token you set as CRON_SECRET to authenticate itself.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: duePosts } = await admin
    .from('posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)

  for (const post of duePosts ?? []) {
    await admin.from('posts').update({ status: 'posting' }).eq('id', post.id)
    await fetch(`${request.nextUrl.origin}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id }),
    })
  }

  return NextResponse.json({ processed: duePosts?.length ?? 0 })
}
