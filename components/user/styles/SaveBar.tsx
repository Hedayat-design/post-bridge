import { platformLabel } from '@/lib/user/styles'

/** The save result ("Saved X." or the error) and the save button. */
export function SaveBar({
  platform,
  message,
  saving,
  onSave,
}: {
  platform: string
  message: string
  saving: boolean
  onSave: () => void
}) {
  return (
    <>
      {message && (
        <p
          className={`text-sm mb-4 ${
            message.startsWith('Saved') ? 'text-success' : 'text-danger'
          }`}
        >
          {message}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-primary text-primary-fg font-semibold py-3 rounded-xl shadow-card transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save ${platformLabel(platform)} style`}
      </button>
    </>
  )
}
