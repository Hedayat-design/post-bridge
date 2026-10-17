import { initials } from '@/lib/team/roles'

/**
 * Initials on a navy disc with a hairline gold ring. The tint varies a little
 * by name so a list of people is scannable, but stays inside the palette —
 * a rainbow of avatars would be the loudest thing on a navy page.
 */
const TINTS = ['#1B365D', '#23446F', '#2A3F5F', '#1F3A52', '#33405A']

function tintFor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return TINTS[Math.abs(hash) % TINTS.length]
}

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-14 w-14 text-base',
} as const

export function Avatar({
  name,
  size = 'md',
  muted = false,
}: {
  name: string
  size?: keyof typeof SIZES
  muted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tracking-wide ${
        muted ? 'border-hairline text-faint' : 'border-accent-bright/40 text-ivory'
      }`}
      style={{ backgroundColor: muted ? 'transparent' : tintFor(name) }}
    >
      {initials(name)}
    </span>
  )
}
