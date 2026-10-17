import { captionAsPublished } from '@/lib/adapters/overrides'
import { SocialAccount, strictestLimit, tabLabel } from '@/lib/user/compose'

/**
 * One platform's caption in the generator's side-by-side grid: editable,
 * counted against the strictest selected account, rewritable or discardable.
 * Editing here edits the same override as that platform's tab.
 */
export function GeneratedCaptionCard({
  platform,
  text,
  accounts,
  generating,
  onRewrite,
  onEdit,
}: {
  platform: string
  text: string
  accounts: SocialAccount[]
  generating: boolean
  onRewrite: () => void
  /** A new text, or null to discard the override. */
  onEdit: (value: string | null) => void
}) {
  const limit = strictestLimit(platform, accounts)
  const published = captionAsPublished(platform, text)
  const over = published.length > limit

  return (
    <div className="border border-hairline bg-sunken rounded-xl p-3 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-ink">{tabLabel(platform)}</span>
        <button
          type="button"
          onClick={onRewrite}
          disabled={generating}
          className="text-xs text-primary underline underline-offset-2 disabled:opacity-50"
        >
          Rewrite
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => onEdit(e.target.value)}
        className="w-full flex-1 border border-hairline bg-surface rounded-lg px-2.5 py-2 h-32 text-sm transition-colors focus:border-primary"
      />

      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-xs ${over ? 'text-danger' : 'text-faint'}`}>
          {published.length} / {limit}
        </span>
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-danger"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
