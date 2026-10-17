import { Dispatch, SetStateAction } from 'react'
import { appendLinks, replyCountLabel } from '@/lib/user/compose'

/**
 * The X first comment and thread — the other half of link stripping. The
 * post body cannot carry a link without X demoting it, so the link goes in a
 * reply instead, and replies keep their links. Thread entries chain on under
 * it. Only shown when an X account is selected.
 */
export function XReplies({
  firstComment,
  setFirstComment,
  thread,
  setThread,
  linksToOffer,
  error,
  hasReplies,
}: {
  firstComment: string
  setFirstComment: Dispatch<SetStateAction<string>>
  thread: string[]
  setThread: (thread: string[]) => void
  /** Links stripped from the X post that the reply doesn't carry yet. */
  linksToOffer: string[]
  error: string | null
  hasReplies: boolean
}) {
  return (
    <div className="border border-accent/30 bg-accent-soft/40 rounded-2xl p-4 mb-6">
      <p className="text-sm font-medium text-ink mb-1">X reply</p>

      {linksToOffer.length > 0 && (
        <button
          type="button"
          onClick={() => setFirstComment((current) => appendLinks(current, linksToOffer))}
          className="text-xs font-medium text-primary underline underline-offset-2 mb-2 block text-left"
        >
          Put {linksToOffer.length > 1 ? 'the removed links' : 'the removed link'} in the
          first comment
        </button>
      )}

      <textarea
        placeholder="First comment — posted as a reply once the tweet is live. Links are kept here."
        value={firstComment}
        onChange={(e) => setFirstComment(e.target.value)}
        className="w-full border border-hairline bg-surface rounded-xl px-3 py-2 h-20 text-sm transition-colors focus:border-primary"
      />

      {thread.map((entry, i) => (
        <div key={i} className="flex gap-2 mt-2">
          <textarea
            placeholder={`Thread entry ${i + 1}`}
            value={entry}
            onChange={(e) =>
              setThread(thread.map((t, j) => (j === i ? e.target.value : t)))
            }
            className="flex-1 border border-hairline bg-surface rounded-xl px-3 py-2 h-16 text-sm transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setThread(thread.filter((_, j) => j !== i))}
            className="text-xs text-muted underline underline-offset-2 self-start pt-2 transition-colors hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setThread([...thread, ''])}
          className="text-xs font-medium text-primary underline underline-offset-2"
        >
          + Add a thread entry
        </button>
        <span className="text-xs text-muted">{replyCountLabel(firstComment, thread)}</span>
      </div>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {/* A reply is posted after the tweet is live, so it can fail on its
          own. Saying so here beats a surprise on the dashboard. */}
      {!error && hasReplies && (
        <p className="text-xs text-muted mt-2">
          Replies go out after the post itself. If one fails the post still
          stands, and the dashboard shows which reply did not.
        </p>
      )}
    </div>
  )
}
