/**
 * Visible on every page while mock mode is on. A demo that looks identical to
 * production is exactly how someone ends up believing a post went out.
 */
export function MockBanner() {
  const enabled =
    process.env.NEXT_PUBLIC_PLATFORM_MOCK === '1' ||
    process.env.NEXT_PUBLIC_PLATFORM_MOCK === 'true'

  if (!enabled) return null

  return (
    <div className="bg-amber-400 text-amber-950 text-sm font-medium px-4 py-2 text-center">
      Demo mode — accounts are simulated and nothing is published to any real
      platform.
    </div>
  )
}
