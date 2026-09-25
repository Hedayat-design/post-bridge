import { supabaseServer } from '@/lib/supabase/server'
import { PLATFORMS, PLAN_LIMITS, Platform } from '@/lib/platforms'
import { redirect } from 'next/navigation'
import { platformAvailable } from '@/lib/adapters'

const ERRORS: Record<string, string> = {
  state_mismatch: 'That connection attempt expired or could not be verified. Please try again.',
  token_exchange_failed: 'The platform refused the authorization code. Check your app credentials.',
  profile_lookup_failed: 'Connected, but we could not read the account profile. Check your app scopes.',
  account_save_failed: 'Could not save the connected account.',
  invalid_callback: 'The platform returned an incomplete response.',
  access_denied: 'You declined the permission request.',
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string }
}) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single()

  const { data: connected } = await supabase
    .from('social_accounts').select('*').eq('user_id', user.id)

  const limit = PLAN_LIMITS[profile?.plan ?? 'free']
  const connectedPlatforms = new Set(connected?.map((c) => c.platform))
  const atLimit = (connected?.length ?? 0) >= limit

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-1">Connected accounts</h1>
      <p className="text-black/60 text-sm mb-8">
        {connected?.length ?? 0} of {limit === Infinity ? 'unlimited' : limit} accounts connected on your {profile?.plan ?? 'free'} plan.
      </p>

      {searchParams.error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {ERRORS[searchParams.error] ?? `Something went wrong (${searchParams.error}).`}
        </p>
      )}
      {searchParams.success && (
        <p className="mb-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          Account connected.
        </p>
      )}

      <div className="space-y-3">
        {(Object.keys(PLATFORMS) as Platform[]).map((key) => {
          const config = PLATFORMS[key]
          const isConnected = connectedPlatforms.has(key)
          // In demo mode every platform works, so none should say "coming soon".
          const available = platformAvailable(key)

          return (
            <div key={key} className="flex items-center justify-between border rounded-xl px-5 py-4">
              <div>
                <span className="font-medium">{config.label}</span>
                {!available && (
                  <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    Coming soon
                  </span>
                )}
              </div>

              {isConnected ? (
                <span className="text-sm font-medium text-green-600">Connected ✓</span>
              ) : !available ? (
                <span className="text-sm text-black/30">Not available yet</span>
              ) : atLimit ? (
                <a href="/pricing" className="text-sm font-semibold text-indigo-600 underline">
                  Upgrade to add more
                </a>
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
