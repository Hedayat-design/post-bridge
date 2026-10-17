'use client'

import { useState } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, Role } from '@/lib/team/roles'
import { addMember } from '@/components/admin/team/teamApi'

/** Name, optional email and title, and a role from the ones you may grant. */
export function AddMemberForm({ roles, onDone }: { roles: Role[]; onDone: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    title: '',
    role: roles.includes('editor') ? 'editor' : roles[0],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const problem = await addMember(form)
    setBusy(false)
    if (problem) setError(problem)
    else onDone()
  }

  const input = 'mt-1.5 w-full rounded-lg border border-hairline-strong px-3 py-2 text-sm text-ink'

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl border border-accent/30 bg-sunken/40 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-muted">
          Name
          <input required maxLength={80} value={form.name} onChange={set('name')} className={input} />
        </label>
        <label className="text-xs font-medium text-muted">
          Email <span className="text-faint">(optional)</span>
          <input type="email" maxLength={254} value={form.email} onChange={set('email')} className={input} />
        </label>
        <label className="text-xs font-medium text-muted">
          Title <span className="text-faint">(optional)</span>
          <input maxLength={80} value={form.title} onChange={set('title')} className={input} />
        </label>
        <label className="text-xs font-medium text-muted">
          Role
          <select value={form.role} onChange={set('role')} className={input}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-muted">{ROLE_DESCRIPTIONS[form.role as Role]}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add to team'}
        </button>
      </div>
    </form>
  )
}
