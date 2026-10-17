import { teamModeState } from '@/lib/team/mode'

/** A reminder, on the page where roles are handed out, that roles are not security yet. */
export function TeamModeNotice() {
  if (teamModeState() !== 'on') return null
  return (
    <p className="rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-muted">
      <span className="font-semibold text-ink">No passwords yet.</span> Anyone who can open this app can pick any name,
      so roles keep people in their lane — they don’t keep anyone out. Turn login on before launch.
    </p>
  )
}
