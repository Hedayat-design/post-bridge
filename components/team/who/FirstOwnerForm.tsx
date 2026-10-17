'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * On a brand-new workspace: add yourself and become its owner. The API makes
 * the first member the owner and picks them, so this lands straight inside.
 */
export function FirstOwnerForm({ next }: { next: string | null }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title }),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Could not create the workspace.')
      setBusy(false)
      return
    }
    // The first member is always the owner, whose home is the admin site.
    router.replace(next ?? '/admin')
    router.refresh()
  }

  return (
    <form onSubmit={create} className="rounded-2xl border border-accent/40 bg-surface/80 p-6 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">You’re the first one here</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Add yourself and you become the workspace owner. You can add the rest of the team from the admin dashboard.
      </p>
      <label className="mt-5 block text-sm font-medium text-ink">
        Your name
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline-strong px-3.5 py-2.5"
          placeholder="e.g. Alex Morgan"
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-ink">
        Title <span className="font-normal text-faint">(optional)</span>
        <input
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline-strong px-3.5 py-2.5"
          placeholder="e.g. Head of Social"
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="mt-6 w-full rounded-full bg-primary px-5 py-3 font-semibold text-primary-fg shadow-gold transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create workspace →'}
      </button>
    </form>
  )
}
