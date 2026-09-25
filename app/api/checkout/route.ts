import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseServer } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  creator: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREATOR,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
}

export async function POST(request: NextRequest) {
  const { plan } = await request.json()
  const priceId = PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })

  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('stripe_customer_id').eq('id', session.user.id).single()

  let customerId = profile?.stripe_customer_id ?? undefined
  if (!customerId) {
    const customer = await stripe.customers.create({ email: session.user.email })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', session.user.id)
  }

  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${request.nextUrl.origin}/dashboard?upgraded=1`,
    cancel_url: `${request.nextUrl.origin}/pricing`,
    metadata: { user_id: session.user.id, plan },
  })

  return NextResponse.json({ url: checkout.url })
}
