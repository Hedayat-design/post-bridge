import Link from 'next/link'
import { revealDelay } from '@/components/landing/content'

/** The close: one action. data-warp="2.5" gives it the strongest warp. */
export function CloseSection() {
  return (
    <section data-warp="2.5" className="flex min-h-[80svh] flex-col items-center justify-center px-6 py-28 text-center">
      <h2 data-reveal className="font-display max-w-3xl text-5xl font-bold leading-[1.05] text-ink sm:text-7xl">
        Try it on your next post.
      </h2>
      <p data-reveal style={revealDelay(1)} className="mt-7 max-w-xl text-lg leading-relaxed text-ink/80">
        Upload one image and read what Post Bridge writes for each platform before anything is published. If a
        caption isn’t right, change it — or don’t post it.
      </p>
      <div data-reveal style={revealDelay(2)} className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-fg shadow-gold transition-colors hover:bg-primary-hover"
        >
          Try it free →
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-hairline-strong bg-bg/40 px-8 py-4 text-lg font-semibold text-ink backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
        >
          Log in
        </Link>
      </div>
      <p data-reveal style={revealDelay(3)} className="mt-14 text-xs uppercase tracking-[0.28em] text-faint">
        Before you go — click anywhere in the sky
      </p>
    </section>
  )
}
