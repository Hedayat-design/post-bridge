import { InheritedCaption, SocialAccount, tabLabel } from '@/lib/user/compose'

/**
 * Per-account captions under a platform tab. Two accounts on one platform can
 * want different text — a personal and a company handle, say — which is why
 * overrides are keyed by account as well. Only shown when there is a choice
 * to make.
 */
export function AccountCaptionFields({
  platform,
  accounts,
  accountCaption,
  onChange,
}: {
  platform: string
  /** The selected accounts on this platform. */
  accounts: SocialAccount[]
  accountCaption: (accountId: string, platform: string) => InheritedCaption
  /** A new text for one account, or null to drop its override. */
  onChange: (accountId: string, value: string | null) => void
}) {
  if (accounts.length <= 1) return null

  return (
    <>
      {accounts.map((a) => {
        const current = accountCaption(a.id, platform)
        return (
          <div key={a.id} className="mt-3 border-l-2 border-hairline pl-3">
            <p className="text-xs font-medium text-ink mb-1">
              {a.display_name ?? a.id.slice(0, 8)}
              {current.overridden ? '' : ' — inherits the caption above'}
            </p>
            {current.overridden ? (
              <>
                <textarea
                  value={current.text}
                  onChange={(e) => onChange(a.id, e.target.value)}
                  className="w-full border border-hairline bg-surface rounded-xl px-3 py-2 h-20 text-sm transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  className="text-xs underline underline-offset-2 text-primary"
                  onClick={() => onChange(a.id, null)}
                >
                  Use the {tabLabel(platform)} caption
                </button>
              </>
            ) : (
              <button
                type="button"
                className="text-xs underline underline-offset-2 text-primary"
                onClick={() => onChange(a.id, current.text)}
              >
                Customise for this account
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
