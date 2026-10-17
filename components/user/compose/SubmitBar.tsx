/** The submit error (upload or API), and the Post now / Schedule post button. */
export function SubmitBar({
  message,
  disabled,
  submitting,
  scheduled,
  onSubmit,
}: {
  message: string
  disabled: boolean
  submitting: boolean
  scheduled: boolean
  onSubmit: () => void
}) {
  return (
    <>
      {message && <p className="text-sm text-danger bg-danger-soft border border-danger/25 rounded-xl px-4 py-3 mb-4 whitespace-pre-wrap">{message}</p>}

      <button
        onClick={onSubmit}
        disabled={disabled}
        className="w-full bg-primary text-primary-fg font-semibold py-3 rounded-xl shadow-card transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary"
      >
        {submitting ? 'Publishing…' : scheduled ? 'Schedule post' : 'Post now'}
      </button>
    </>
  )
}
