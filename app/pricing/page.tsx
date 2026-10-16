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
      <h1 className="text-3xl font-bold text-center text-ink mb-2">Get more views, with less effort.</h1>
      <p className="text-center text-muted mb-14">2 months free — billed annually.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`relative rounded-2xl border p-8 flex flex-col ${
              p.popular
                ? // The featured tier is the one place gold covers real area,
                  // and it sits on deep sapphire rather than the page itself.
                  'border-accent/40 bg-sapphire-900 text-white shadow-lift'
                : 'border-hairline bg-surface text-ink shadow-card'
            }`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-8 rounded-full bg-accent-bright px-3 py-1 text-xs font-semibold tracking-wide text-sapphire-950">
                Most popular
              </span>
            )}

            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <p className={`text-sm mb-6 ${p.popular ? 'text-white/65' : 'text-muted'}`}>{p.blurb}</p>
            <div className="text-4xl font-bold mb-6">
              ${p.price}
              <span className={`text-base font-medium ${p.popular ? 'text-white/50' : 'text-faint'}`}>/mo</span>
            </div>
            <ul className="text-sm space-y-2.5 mb-8 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className={p.popular ? 'text-accent-bright' : 'text-accent'}>✓</span>
                  <span className={p.popular ? 'text-white/85' : 'text-muted'}>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => upgrade(p.key)}
              disabled={loadingPlan === p.key}
              className={`py-3 rounded-full font-semibold transition-colors disabled:opacity-50 ${
                p.popular
                  ? 'bg-accent-bright text-sapphire-950 hover:bg-champagne-200'
                  : 'bg-primary text-primary-fg hover:bg-primary-hover'
              }`}
            >
              {loadingPlan === p.key ? 'Redirecting…' : 'Start posting instantly'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
