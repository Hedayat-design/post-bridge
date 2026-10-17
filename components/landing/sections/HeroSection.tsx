import Link from 'next/link'
import { revealDelay } from '@/components/landing/content'

/**
 * Hero: one star. The star itself is drawn by the scene at the
 * data-anchor="hero" span; this file only leaves room for it.
 */
export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100svh-6rem)] flex-col items-center justify-center px-6 pb-16 pt-10 text-center">
      <p data-reveal className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
        For anyone who posts in more than one place
      </p>

      <span data-anchor="hero" aria-hidden className="mt-8 block h-28 w-28" />
      <p data-reveal style={revealDelay(1)} className="font-display -mt-2 text-lg italic text-accent/90">
        This is your post.
      </p>

      <h1
        data-reveal
        style={revealDelay(2)}
        className="font-display mt-8 max-w-4xl text-[2.5rem] font-bold leading-[1.05] text-ink sm:text-6xl lg:text-7xl"
      >
        How to post to every platform in the time it takes to post to one.
      </h1>

      <p data-reveal style={revealDelay(3)} className="mt-7 max-w-2xl text-lg leading-relaxed text-ink/80">
        Upload one image. Post Bridge writes a caption for each platform in your own voice, fits it to that
        platform’s rules, and publishes it on the minute you choose.
      </p>

      <div data-reveal style={revealDelay(4)} className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-fg shadow-gold transition-colors hover:bg-primary-hover"
        >
          Try it free →
        </Link>
        <Link
          href="#constellation"
          className="rounded-full border border-hairline-strong bg-bg/40 px-7 py-3.5 font-semibold text-ink backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
        >
          See where it goes
        </Link>
      </div>

      {/* Only on tall screens: on a short one it collides with the buttons. */}
      <div
        aria-hidden
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 [@media(min-height:820px)]:flex"
      >
        <span className="text-[10px] uppercase tracking-[0.32em] text-faint">Scroll</span>
        <span className="block h-10 w-px overflow-hidden">
          <span className="scroll-cue block h-full w-full bg-accent-bright/70" />
        </span>
      </div>
    </section>
  )
}
