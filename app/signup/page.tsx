'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = supabaseBrowser()

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        plan: 'free',
      })
    }

    router.push('/dashboard')
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold text-ink mb-6">Create your account</h1>
      <form onSubmit={handleSignup} className="space-y-4">
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-hairline bg-surface rounded-lg px-4 py-2.5 transition-colors focus:border-primary"
        />
        <input
          type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-hairline bg-surface rounded-lg px-4 py-2.5 transition-colors focus:border-primary"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full bg-primary text-primary-fg font-semibold py-2.5 rounded-lg shadow-card transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </div>
  )
}
