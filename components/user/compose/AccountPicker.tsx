import { SocialAccount } from '@/lib/user/compose'

/** "Post to": one pill per connected account, toggled on and off. */
export function AccountPicker({
  accounts,
  selected,
  onToggle,
}: {
  accounts: SocialAccount[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <>
      <p className="text-sm font-medium text-ink mb-2">Post to</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {accounts.length === 0 && (
          <p className="text-sm text-muted">No connected accounts yet — <a href="/connect" className="text-primary underline underline-offset-2">connect one</a>.</p>
        )}
        {accounts.map((a) => (
          <button
            key={a.id} type="button" onClick={() => onToggle(a.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              selected.includes(a.id)
                ? 'bg-primary text-primary-fg border-primary shadow-card'
                : 'border-hairline-strong text-ink hover:border-primary hover:text-primary'
            }`}
          >
            {a.platform}{a.display_name ? ` · ${a.display_name}` : ''}
          </button>
        ))}
      </div>
    </>
  )
}
