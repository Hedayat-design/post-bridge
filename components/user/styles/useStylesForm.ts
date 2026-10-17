'use client'
import { useEffect, useState } from 'react'
import { PLATFORMS, Style, blankStyle, platformLabel, stylesByPlatform } from '@/lib/user/styles'

/**
 * The styles page's state: every platform's style, the open tab, and loading
 * from / saving to /api/styles. Edits stay local until saved, one platform at
 * a time.
 */
export function useStylesForm() {
  const [styles, setStyles] = useState<Record<string, Style>>({})
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/styles')
      .then((r) => r.json())
      .then((data) => setStyles(stylesByPlatform(data.styles)))
      .finally(() => setLoading(false))
  }, [])

  const current = styles[platform] ?? blankStyle(platform)

  function update(patch: Partial<Style>) {
    setStyles((prev) => ({ ...prev, [platform]: { ...current, ...patch } }))
    setMessage('')
  }

  async function save() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/styles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    setMessage(res.ok ? `Saved ${platformLabel(platform)}.` : data.error ?? 'Could not save')
  }

  return { styles, platform, setPlatform, loading, saving, message, current, update, save }
}
