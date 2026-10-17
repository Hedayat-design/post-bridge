'use client'

import { Avatar } from '@/components/team/Avatar'
import { RoleBadge } from '@/components/team/RoleBadge'
import { ROLES, ROLE_LABELS, MemberStatus, Role, canManage } from '@/lib/team/roles'
import { removeMember, updateMember } from '@/components/admin/team/teamApi'

export type RosterMember = {
  id: string
  name: string
  email: string | null
  title: string | null
  role: Role
  status: MemberStatus
  lastActive: string
  posts: number
}

/**
 * One member: who, role (a picker if you may change it), status, last active,
 * posts this month, and suspend / remove. Nobody can suspend or remove
 * themselves here; the API enforces the same and the last-owner rule.
 */
export function MemberRow({
  member: m,
  actorId,
  actorRole,
  roles,
  busy,
  confirming,
  run,
  confirm,
}: {
  member: RosterMember
  actorId: string | null
  actorRole: Role
  /** Roles the actor may grant. */
  roles: Role[]
  busy: string | null
  confirming: string | null
  run: (key: string, action: () => Promise<string | null>) => void
  confirm: (id: string) => void
}) {
  const manageable = canManage(actorRole, m.role)
  const self = m.id === actorId
  const suspended = m.status === 'suspended'

  return (
    <tr className={`border-t border-hairline ${suspended ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={m.name} muted={suspended} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {m.name}
              {self && <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">You</span>}
            </p>
            <p className="truncate text-xs text-muted">{[m.title, m.email].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        {manageable ? (
          <select
            aria-label={`Role for ${m.name}`}
            value={m.role}
            disabled={busy !== null}
            onChange={(e) => run(m.id, () => updateMember(m.id, { role: e.target.value }))}
            className="rounded-lg border border-hairline-strong px-2 py-1.5 text-xs font-medium"
          >
            {ROLES.filter((r) => r === m.role || roles.includes(r)).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <RoleBadge role={m.role} />
        )}
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink/85">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${suspended ? 'bg-faint' : 'bg-accent-bright'}`} />
          {suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">{m.lastActive}</td>
      <td className="px-4 py-3 text-right tabular-nums text-ink/85">{m.posts}</td>

      <td className="px-4 py-3">
        {manageable && !self && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run(m.id, () => updateMember(m.id, { status: suspended ? 'active' : 'suspended' }))}
              className="rounded-lg border border-hairline-strong px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {suspended ? 'Reactivate' : 'Suspend'}
            </button>
            {confirming === m.id ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run(m.id, () => removeMember(m.id))}
                className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === m.id ? 'Removing…' : 'Confirm remove'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => confirm(m.id)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
