import {
  LIVE_PLATFORMS,
  PLATFORM_KEYS,
  SOON_PLATFORMS,
  list,
  platformLabel,
  revealDelay,
  spell,
} from '@/components/landing/content'
import { PlatformStar } from '@/components/landing/sections/PlatformStar'

/**
 * The constellation: where the hero's star lands and threads out to every
 * platform. The scene draws the threads between data-anchor="centre" and each
 * PlatformStar; this file is the box they live in, plus the copy around it.
 */
export function ConstellationSection() {
  const count = spell(PLATFORM_KEYS.length)

  return (
    <section id="constellation" data-warp="1" className="relative scroll-mt-24 px-6 pb-10 pt-28 sm:pt-36">
      <div className="mx-auto max-w-3xl text-center">
        <p data-reveal className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
          One upload · {count} platforms
        </p>
        <h2
          data-reveal
          style={revealDelay(1)}
          className="font-display mt-5 text-4xl font-bold leading-tight text-ink sm:text-5xl"
        >
          It doesn’t copy your post {count} times. It writes it {count} times.
        </h2>
        <p data-reveal style={revealDelay(2)} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/80">
          A caption that works on LinkedIn is too long for X and too bare for Instagram. So Post Bridge writes each
          one separately — from the same image, in the same voice, to each platform’s own limits.
        </p>
      </div>

      <div data-constellation className="relative mx-auto mt-16 aspect-[4/5] w-full max-w-4xl sm:aspect-[16/9]">
        <span data-anchor="centre" aria-hidden className="absolute left-1/2 top-1/2 h-0 w-0" />
        {PLATFORM_KEYS.map((p) => (
          <PlatformStar key={p} platform={p} />
        ))}
      </div>

      {/* Ogilvy: more people read the caption under a picture than the copy
          beside it. So the honest part goes here. */}
      <p data-reveal className="mx-auto mt-14 max-w-2xl text-center text-sm leading-relaxed text-muted">
        <span className="text-accent">Gold threads publish today:</span> {list(LIVE_PLATFORMS.map(platformLabel))}.
        The dashed ones — {list(SOON_PLATFORMS.map(platformLabel))} — are being connected now. We would rather tell
        you here than after you sign up. <span className="text-ink/80">Hover or tap a star to see its rules.</span>
      </p>
    </section>
  )
}
