/**
 * The wordmark — a gold ring on navy, the palette in one element.
 *
 * Lives on its own because the nav and the footer both show it at slightly
 * different sizes; duplicating the ring markup in two files is how the two
 * drift apart.
 */
const SIZES = {
  sm: { ring: 'h-6 w-6', dot: 'h-1.5 w-1.5', text: 'text-base' },
  md: { ring: 'h-7 w-7', dot: 'h-2 w-2', text: 'text-lg' },
} as const

export function SiteMark({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  return (
    <>
      <span
        className={`${s.ring} rounded-full border border-accent-bright/70 grid place-items-center`}
      >
        <span className={`${s.dot} rounded-full bg-accent-bright`} />
      </span>
      <span className={`font-display ${s.text} font-semibold tracking-tight text-ink`}>
        Post Bridge
      </span>
    </>
  )
}
