'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MemberTile, PickableMember } from '@/components/team/who/MemberTile'
import { FirstOwnerForm } from '@/components/team/who/FirstOwnerForm'

/**
 * The team-mode front door: pick your name, or — on a brand-new workspace —
 * add yourself as its owner.
 *
 * Afterwards each role lands on its own site (homeFor in lib/team/roles.ts):
 * owners and admins on /admin, everyone else on /dashboard — unless they
 * were on their way somewhere specific (?next=).
 */
export function WhoPicker({
  members,
  currentId,
  next,
}: {
  members: PickableMember[]
  currentId: string | null
  next: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function pick(id: string) {
    setBusy(id)
    setError('')
    const res = await fetch('/api/team/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Could not pick that member.')
      setBusy(null)
      return
    }
    router.replace(next ?? json.home ?? '/dashboard')
    router.refresh()
  }

  if (members.length === 0) return <FirstOwnerForm next={next} />

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.id}>
            <MemberTile
              member={m}
              current={m.id === currentId}
              busy={busy === m.id}
              disabled={busy !== null}
              onPick={() => pick(m.id)}
            />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
