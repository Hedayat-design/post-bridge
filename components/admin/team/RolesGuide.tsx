import { Panel } from '@/components/admin/ui/Panel'
import { RoleBadge } from '@/components/team/RoleBadge'
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, Role } from '@/lib/team/roles'

/** What each role can do, and how many people hold it. */
export function RolesGuide({ roles }: { roles: Role[] }) {
  return (
    <Panel title="What each role can do">
      <ul className="space-y-4">
        {ROLES.map((r) => {
          const count = roles.filter((x) => x === r).length
          return (
            <li key={r}>
              <div className="flex items-center justify-between gap-3">
                <RoleBadge role={r} />
                <span className="text-xs tabular-nums text-faint">
                  {count} {ROLE_LABELS[r].toLowerCase()}
                  {count === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{ROLE_DESCRIPTIONS[r]}</p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
