import Link from 'next/link'
import { PRICE_TIERS, revealDelay } from '@/components/landing/content'

/** The offer, with the prices stated — Ogilvy: never hide the price. */
export function OfferSection() {
  return (
    <section data-warp="1" className="copy-scrim px-6 py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h2 data-reveal className="font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
          Start free. Pay when you outgrow one account.
        </h2>
        <span className="rule-gold mx-auto mt-7 block w-28" />
        <dl
          data-reveal
          style={revealDelay(1)}
          className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4"
        >
          {PRICE_TIERS.map((tier) => (
            <div key={tier.plan} className="bg-bg/85 px-4 py-6">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{tier.plan}</dt>
              <dd className="font-display mt-2 text-3xl font-bold text-ink">
                {tier.price}
                <span className="text-sm font-normal text-faint">/mo</span>
              </dd>
              <dd className="mt-1 text-sm text-accent">{tier.accounts}</dd>
            </div>
          ))}
        </dl>
        <p data-reveal style={revealDelay(2)} className="mt-6 text-ink/75">
          Every paid plan includes unlimited posts, scheduling and carousels.{' '}
          <Link href="/pricing" className="font-semibold text-accent underline-offset-4 hover:underline">
            Compare plans →
          </Link>
        </p>
      </div>
    </section>
  )
}
