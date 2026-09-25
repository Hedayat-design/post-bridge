import { supabaseServer } from '@/lib/supabase'
import { PLATFORMS, PLAN_LIMITS, Platform } from '@/lib/platforms'
import { redirect } from 'next/navigation'

export default async function ConnectPage() {
  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', session.user.id).single()

  const { data: connected } = await supabase
    .from('social_accounts').select('*').eq('user_id', session.user.id)

  const limit = PLAN_LIMITS[profile?.plan ?? 'free']
  const connectedPlatforms = new Set(connected?.map((c) => c.platform))

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-1">Connected accounts</h1>
      <p className="text-black/60 text-sm mb-8">
        {connected?.length ?? 0} of {limit === Infinity ? 'unlimited' : limit} accounts connected on your {profile?.plan ?? 'free'} plan.
      </p>

      <div className="space-y-3">
        {(Object.keys(PLATFORMS) as Platform[]).map((key) => {
          const isConnected = connectedPlatforms.has(key)
          return (
            <div key={key} className="flex items-center justify-between border rounded-xl px-5 py-4">
              <span className="font-medium">{PLATFORMS[key].label}</span>
              {isConnected ? (
                <span className="text-sm font-medium text-green-600">Connected ✓</span>
              ) : (
                <a
                  href={`/api/oauth/${key}`}
                  className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Connect
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
