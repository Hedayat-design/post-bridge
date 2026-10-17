import { teamModeState } from '@/lib/team/mode'

/**
 * Visible on every page while team mode is on. A workspace with no login must
 * never be mistaken for one that has it — least of all by whoever is deciding
 * whether it is ready to launch.
 */
export function TeamModeBanner() {
  if (teamModeState() === 'off') return null

  return (
    <div className="bg-ocean px-4 py-1.5 text-center text-xs font-medium text-ivory/90">
      <span className="mr-2 font-semibold uppercase tracking-[0.16em] text-champagne">Team mode</span>
      No login — anyone who can open this address can act as any team member. Turn login on before
      launch.
    </div>
  )
}
