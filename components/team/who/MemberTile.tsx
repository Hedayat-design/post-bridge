import { Avatar } from '@/components/team/Avatar'
import { RoleBadge } from '@/components/team/RoleBadge'
import type { Role } from '@/lib/team/roles'

export type PickableMember = { id: string; name: string; title: string | null; role: Role }

/** One person on the "Who's working?" screen. Gold when it's who you are now. */
export function MemberTile({
  member: m,
  current,
  busy,
  disabled,
  onPick,
}: {
  member: PickableMember
  current: boolean
  busy: boolean
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all disabled:cursor-wait ${
        current
          ? 'border-accent/60 bg-accent-soft/60'
          : 'border-hairline bg-surface/70 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface'
      }`}
    >
      <Avatar name={m.name} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{m.name}</span>
        <span className="block truncate text-sm text-muted">{m.title || '—'}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <RoleBadge role={m.role} />
          {current && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">You now</span>}
        </span>
      </span>
      <span aria-hidden className="text-lg text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
        {busy ? '…' : '→'}
      </span>
    </button>
  )
}
