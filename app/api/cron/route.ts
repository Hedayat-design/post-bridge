import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 300

// Configure in vercel.json to hit this every minute, e.g.:
// { "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
// Vercel sends a bearer token you set as CRON_SECRET to authenticate itself.

const BATCH = 20 // bound the work so one run can't exceed the function timeout

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: duePosts } = await admin
    .from('posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH)

  let processed = 0

  for (const post of duePosts ?? []) {
    // Claim the post by flipping scheduled → posting and checking that this
    // run is the one that changed it. Without the status filter two
    // overlapping cron runs would both publish the same post.
    const { data: claimed } = await admin
      .from('posts')
      .update({ status: 'posting' })
      .eq('id', post.id)
      .eq('status', 'scheduled')
      .select('id')

    if (!claimed?.length) continue

    try {
      const res = await fetch(`${request.nextUrl.origin}/api/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
        },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!res.ok) throw new Error(`publish returned ${res.status}`)
      processed++
    } catch (e) {
      // Release the claim instead of leaving the post stuck in 'posting'
      // forever, so the next run can retry it.
      await admin
        .from('posts')
        .update({ status: 'scheduled' })
        .eq('id', post.id)
        .eq('status', 'posting')
      console.error(`cron: post ${post.id} failed to dispatch`, e)
    }
  }

  return NextResponse.json({ due: duePosts?.length ?? 0, processed })
}
