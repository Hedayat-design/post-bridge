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
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Connected accounts</h1>
      <p className="text-muted text-sm mb-8">
        {connected?.length ?? 0} of {limit === Infinity ? 'unlimited' : limit} accounts connected on your {profile?.plan ?? 'free'} plan.
      </p>

      {searchParams.error && (
        <p className="mb-6 text-sm text-danger bg-danger-soft border border-danger/25 rounded-xl px-4 py-3">
          {ERRORS[searchParams.error] ?? `Something went wrong (${searchParams.error}).`}
        </p>
      )}
      {searchParams.success && (
        <p className="mb-6 text-sm text-success bg-success-soft border border-success/25 rounded-xl px-4 py-3">
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
            <div key={key} className="flex items-center justify-between border border-hairline bg-surface rounded-xl px-5 py-4 shadow-card transition-colors hover:border-hairline-strong">
              <div>
                <span className="font-medium text-ink">{config.label}</span>
                {!available && (
                  <span className="ml-2 text-xs text-warning bg-warning-soft border border-warning/25 rounded-full px-2 py-0.5">
                    Coming soon
                  </span>
                )}
              </div>

              {isConnected ? (
                <span className="text-sm font-medium text-success">Connected ✓</span>
              ) : !available ? (
                <span className="text-sm text-faint">Not available yet</span>
              ) : atLimit ? (
                <a href="/pricing" className="text-sm font-semibold text-primary underline underline-offset-2">
                  Upgrade to add more
                </a>
              ) : (
                <a
                  href={`/api/oauth/${key}`}
                  className="text-sm font-semibold bg-primary text-primary-fg px-4 py-2 rounded-lg transition-colors hover:bg-primary-hover"
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
