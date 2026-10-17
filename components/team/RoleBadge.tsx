import { ROLE_LABELS, Role } from '@/lib/team/roles'

/** Gold only for the roles that can change things for others. */
const STYLE: Record<Role, string> = {
  owner: 'border-accent/60 bg-accent-soft text-accent',
  admin: 'border-accent/35 text-accent',
  editor: 'border-hairline-strong text-ink/85',
  viewer: 'border-hairline text-muted',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${STYLE[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}
