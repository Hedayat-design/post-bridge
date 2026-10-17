import type { Platform } from '@/lib/platforms'
import { PLATFORMS } from '@/lib/platforms'
import {
  PLATFORM_NOTES,
  STAR_POSITIONS,
  mediaLine,
  platformLabel,
  textLine,
} from '@/components/landing/content'

/**
 * One platform in the constellation: an invisible 48px button where the scene
 * draws the star, its label, and the rules card shown on hover or focus.
 *
 * The wrapper is a 0×0 box at the star's exact point, so the scene can read
 * the centre from it (data-platform-star) and the label and card hang off it.
 * --arrive is written by the scene as the star's thread reaches it.
 */
export function PlatformStar({ platform }: { platform: Platform }) {
  const pos = STAR_POSITIONS[platform]
  const isLive = PLATFORMS[platform].publishImplemented
  const label = platformLabel(platform)
  const cardOnLeft = pos.left > 50
  const cardBelow = pos.top < 50

  return (
    <div
      data-platform-star={platform}
      data-live={isLive}
      className="group absolute h-0 w-0"
      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
    >
      <button
        type="button"
        aria-describedby={`star-${platform}`}
        aria-label={`${label} — ${isLive ? 'publishing today' : 'coming soon'}`}
        className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-5 -translate-x-1/2 whitespace-nowrap text-center transition-opacity"
        style={{ opacity: 'var(--arrive, 1)' }}
      >
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.2em] ${isLive ? 'text-ink' : 'text-muted'}`}>
          {label}
        </span>
        <span className={`block text-[10px] tracking-[0.12em] ${isLive ? 'text-accent' : 'text-faint'}`}>
          {isLive ? 'Live' : 'Soon'}
        </span>
      </span>

      <div
        id={`star-${platform}`}
        role="tooltip"
        className={`pointer-events-none absolute z-10 w-64 rounded-2xl border border-hairline-strong bg-bg/95 p-4 text-left opacity-0 shadow-lift backdrop-blur-md transition duration-300 group-focus-within:opacity-100 group-hover:opacity-100 ${
          cardOnLeft ? 'right-[-1.25rem]' : 'left-[-1.25rem]'
        } ${cardBelow ? 'top-12 translate-y-1 group-hover:translate-y-0' : 'bottom-6 -translate-y-1 group-hover:translate-y-0'}`}
      >
        <p className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold text-ink">{label}</span>
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isLive ? 'bg-accent-soft text-accent' : 'border border-hairline-strong text-faint'
            }`}
          >
            {isLive ? 'Publishing today' : 'Coming soon'}
          </span>
        </p>
        <span className="rule-gold mt-3 block w-full" />
        <ul className="mt-3 space-y-1.5 text-sm text-ink/85">
          <li>{textLine(platform)}</li>
          <li>{mediaLine(platform)}</li>
          <li className="text-muted">{PLATFORM_NOTES[platform]}</li>
        </ul>
      </div>
    </div>
  )
}
