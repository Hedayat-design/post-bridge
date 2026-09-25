'use client'
import { useState } from 'react'

const plans = [
  { key: 'starter', name: 'Starter', price: 29, blurb: 'Grow your reach the easy way', features: ['5 connected accounts', 'Unlimited posts', 'Schedule posts', 'Carousel posts'] },
  { key: 'creator', name: 'Creator', price: 49, blurb: 'Create once, post everywhere', features: ['15 connected accounts', 'Unlimited posts', 'Schedule posts', 'Carousel posts'], popular: true },
  { key: 'pro', name: 'Pro', price: 99, blurb: 'Grow all your accounts, at once', features: ['Unlimited connected accounts', 'Unlimited posts', 'Schedule posts', 'Carousel posts'] },
]

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function upgrade(plan: string) {
    setLoadingPlan(plan)
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoadingPlan(null)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-2">Get more views, with less effort.</h1>
      <p className="text-center text-black/50 mb-14">2 months free — billed annually.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.key} className={`rounded-2xl border p-8 flex flex-col ${p.popular ? 'bg-black text-white' : 'bg-white'}`}>
            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <p className={`text-sm mb-6 ${p.popular ? 'text-white/60' : 'text-black/60'}`}>{p.blurb}</p>
            <div className="text-4xl font-bold mb-6">${p.price}<span className="text-base font-medium opacity-50">/mo</span></div>
            <ul className="text-sm space-y-2.5 mb-8 flex-1">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <button
              onClick={() => upgrade(p.key)}
              disabled={loadingPlan === p.key}
              className={`py-3 rounded-full font-semibold ${p.popular ? 'bg-indigo-500 text-white' : 'bg-black text-white'} disabled:opacity-50`}
            >
              {loadingPlan === p.key ? 'Redirecting…' : 'Start posting instantly'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
