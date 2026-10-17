'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Role, assignableRoles } from '@/lib/team/roles'
import { DataTable } from '@/components/admin/ui/DataTable'
import { AddMemberForm } from '@/components/admin/team/AddMemberForm'
import { MemberRow, RosterMember } from '@/components/admin/team/MemberRow'

/**
 * The roster: add people, change roles, suspend, remove. Controls a role may
 * not use are not shown rather than shown disabled — and the API refuses them
 * regardless (app/api/team/members).
 */
export function TeamManager({
  members,
  actorId,
  actorRole,
}: {
  members: RosterMember[]
  actorId: string | null
  actorRole: Role
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState('')
  const roles = assignableRoles(actorRole)

  /** Runs one change, then refreshes the server data — or shows why not. */
  async function run(key: string, action: () => Promise<string | null>) {
    setBusy(key)
    setError('')
    const problem = await action()
    setBusy(null)
    setConfirming(null)
    if (problem) setError(problem)
    else router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {members.length} member{members.length === 1 ? '' : 's'} · {members.filter((m) => m.status === 'active').length}{' '}
          active
        </p>
        {roles.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            {adding ? 'Close' : '+ Add member'}
          </button>
        )}
      </div>

      {adding && (
        <AddMemberForm
          roles={roles}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <DataTable
        className="mt-5"
        minWidth={720}
        head={
          <tr>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last active</th>
            <th className="px-4 py-3 text-right font-medium">Posts · 30d</th>
            <th className="px-4 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        }
      >
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            actorId={actorId}
            actorRole={actorRole}
            roles={roles}
            busy={busy}
            confirming={confirming}
            run={run}
            confirm={setConfirming}
          />
        ))}
      </DataTable>
    </div>
  )
}
