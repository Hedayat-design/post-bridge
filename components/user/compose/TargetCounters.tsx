import { ComposeTarget, tabLabel } from '@/lib/user/compose'

/**
 * A character count per selected account, each against its own limit. A
 * single minimum across platforms stopped being meaningful once every
 * platform can carry its own text.
 */
export function TargetCounters({ targets, caption }: { targets: ComposeTarget[]; caption: string }) {
  return (
    <div className="mb-6 space-y-0.5">
      {targets.length === 0 && (
        <p className="text-xs text-faint">{caption.length} characters</p>
      )}
      {targets.map((t) => (
        <p
          key={t.account.id}
          className={`text-xs ${t.error ? 'text-danger' : 'text-muted'}`}
        >
          {tabLabel(t.account.platform)}
          {t.account.display_name ? ` · ${t.account.display_name}` : ''}{' '}
          {t.published.length} / {t.limit}
          {t.source !== 'post' ? ` · own caption` : ''}
          {t.strippedALink ? ' · link removed' : ''}
          {t.error ? ` — ${t.error}` : ''}
        </p>
      ))}
      {targets.some((t) => t.strippedALink) && (
        <p className="text-xs text-warning pt-1">
          Links are removed from the X post — X demotes posts that carry one.
          Other platforms keep it.
        </p>
      )}
    </div>
  )
}
