import { CaptionMap, SocialAccount } from '@/lib/user/compose'
import { GeneratedCaptionCard } from './GeneratedCaptionCard'

/**
 * Caption generation. Generated text lands in the per-platform overrides
 * below, so these cards and the tabs are two views of the same data rather
 * than a parallel system. Generation is always on a button and nothing posts
 * without the user reading it.
 */
export function CaptionGenerator({
  selectedPlatforms,
  selectedAccounts,
  platformCaptions,
  onEdit,
  brief,
  onBriefChange,
  hasMedia,
  generating,
  error,
  quotaLeft,
  onGenerate,
}: {
  selectedPlatforms: string[]
  selectedAccounts: SocialAccount[]
  platformCaptions: CaptionMap
  onEdit: (platform: string, value: string | null) => void
  brief: string
  onBriefChange: (brief: string) => void
  hasMedia: boolean
  generating: boolean
  error: string
  quotaLeft: number | null
  onGenerate: (onlyPlatform?: string) => void
}) {
  if (selectedPlatforms.length === 0) return null

  return (
    <div className="border border-hairline bg-surface rounded-2xl p-4 mb-6 shadow-card">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium text-ink">Write captions from the image</p>
        {quotaLeft !== null && (
          <span className="text-xs text-faint">{quotaLeft} generations left</span>
        )}
      </div>

      <input
        value={brief}
        onChange={(e) => onBriefChange(e.target.value)}
        placeholder="Optional steer for this post — angle it at founders, mention the launch…"
        className="w-full border border-hairline bg-surface rounded-xl px-3 py-2 text-sm mb-2 transition-colors focus:border-primary"
      />

      <button
        type="button"
        onClick={() => onGenerate()}
        disabled={generating || !hasMedia}
        className="w-full bg-primary text-primary-fg text-sm font-semibold py-2.5 rounded-xl transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {generating
          ? 'Writing…'
          : !hasMedia
            ? 'Add an image to generate captions'
            : `Generate ${selectedPlatforms.length} caption${selectedPlatforms.length === 1 ? '' : 's'}`}
      </button>

      <p className="text-xs text-faint mt-2">
        Uses your{' '}
        <a href="/styles" className="text-primary underline underline-offset-2">
          caption styles
        </a>
        . Nothing is posted until you say so.
      </p>

      {error && (
        <p className="text-xs text-danger bg-danger-soft border border-danger/25 rounded-xl px-3 py-2 mt-2 whitespace-pre-wrap">
          {error}
        </p>
      )}

      {/* Side by side, so the set can be compared at a glance rather than
          a tab at a time — the whole reason to generate per platform is
          that the versions should differ. */}
      {selectedPlatforms.some((p) => p in platformCaptions) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {selectedPlatforms
            .filter((p) => p in platformCaptions)
            .map((p) => (
              <GeneratedCaptionCard
                key={p}
                platform={p}
                text={platformCaptions[p]}
                accounts={selectedAccounts}
                generating={generating}
                onRewrite={() => onGenerate(p)}
                onEdit={(value) => onEdit(p, value)}
              />
            ))}
        </div>
      )}
    </div>
  )
}
