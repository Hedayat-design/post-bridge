import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { forbidUnless, logActivity } from '@/lib/team/access'
import { LIMITS } from '@/lib/adapters/limits'

/**
 * Read and save the caller's per-platform caption styles.
 *
 * Runs as the signed-in user so RLS scopes every row; this route never filters
 * by user id itself beyond the upsert key.
 */

/** Caps on stored style data, so one row cannot become a prompt of any size. */
const MAX_INSTRUCTIONS = 4000
const MAX_EXAMPLE = 4000
const MAX_EXAMPLES = 12

export async function GET() {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('platform_styles')
    .select('platform, instructions, examples, model, enabled')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ styles: data ?? [] })
}

export async function PUT(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const refused = await forbidUnless('edit_styles')
  if (refused) return refused

  const body = (await request.json()) as {
    platform?: string
    instructions?: unknown
    examples?: unknown
    model?: unknown
    enabled?: unknown
  }

  if (!body.platform || !(body.platform in LIMITS)) {
    return NextResponse.json({ error: `Unknown platform: ${body.platform}` }, { status: 400 })
  }

  const instructions = typeof body.instructions === 'string' ? body.instructions : ''
  if (instructions.length > MAX_INSTRUCTIONS) {
    return NextResponse.json(
      { error: `Instructions are ${instructions.length} characters; the limit is ${MAX_INSTRUCTIONS}` },
      { status: 400 }
    )
  }

  // Blank examples are dropped rather than rejected: an empty box the user
  // added and never filled should not block saving the rest of the form.
  const rawExamples = Array.isArray(body.examples) ? body.examples : []
  const examples = rawExamples
    .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
    .map((e) => e.trim())

  if (examples.length > MAX_EXAMPLES) {
    return NextResponse.json(
      { error: `${examples.length} examples; at most ${MAX_EXAMPLES} are used` },
      { status: 400 }
    )
  }
  const oversized = examples.find((e) => e.length > MAX_EXAMPLE)
  if (oversized) {
    return NextResponse.json(
      { error: `An example is ${oversized.length} characters; the limit is ${MAX_EXAMPLE}` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('platform_styles').upsert(
    {
      user_id: user.id,
      platform: body.platform,
      instructions,
      examples,
      model: typeof body.model === 'string' ? body.model.trim() : '',
      enabled: body.enabled !== false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, 'styles.updated', { platform: body.platform })
  return NextResponse.json({ ok: true })
}
