'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'

type SocialAccount = { id: string; platform: string; display_name: string | null }

export default function ComposePage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [scheduleAt, setScheduleAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = supabaseBrowser()

  useEffect(() => {
    supabase.from('social_accounts').select('id, platform, display_name').then(({ data }) => {
      if (data) setAccounts(data)
    })
  }, [])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setMessage('')

    let mediaUrls: string[] = []
    if (file) {
      const path = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('post-media').upload(path, file)
      if (uploadError) {
        setMessage(uploadError.message)
        setSubmitting(false)
        return
      }
      const { data } = supabase.storage.from('post-media').getPublicUrl(path)
      mediaUrls = [data.publicUrl]
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        mediaUrls,
        mediaType: file?.type.startsWith('video') ? 'video' : 'image',
        scheduledFor: scheduleAt || null,
        socialAccountIds: selected,
      }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage(result.error)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-6">Upload to Post Bridge</h1>

      <label className="block border-2 border-dashed rounded-xl p-8 text-center text-sm text-black/50 cursor-pointer mb-6">
        {file ? file.name : 'Click to choose an image or video'}
        <input type="file" accept="image/*,video/*" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <textarea
        placeholder="Write a caption…" value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full border rounded-xl px-4 py-3 mb-6 h-28"
      />

      <p className="text-sm font-medium mb-2">Post to</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {accounts.length === 0 && (
          <p className="text-sm text-black/50">No connected accounts yet — <a href="/connect" className="underline">connect one</a>.</p>
        )}
        {accounts.map((a) => (
          <button
            key={a.id} type="button" onClick={() => toggle(a.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              selected.includes(a.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-black/15'
            }`}
          >
            {a.platform}{a.display_name ? ` · ${a.display_name}` : ''}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium mb-2">Schedule for later (optional)</label>
      <input
        type="datetime-local" value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
        className="w-full border rounded-xl px-4 py-2.5 mb-6"
      />

      {message && <p className="text-sm text-red-600 mb-4">{message}</p>}

      <button
        onClick={handleSubmit} disabled={submitting || selected.length === 0}
        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
      >
        {submitting ? 'Uploading…' : scheduleAt ? 'Schedule post' : 'Post now'}
      </button>
    </div>
  )
}
