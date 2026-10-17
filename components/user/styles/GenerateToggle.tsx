import { platformLabel } from '@/lib/user/styles'

/** Whether the composer generates captions for this platform at all. */
export function GenerateToggle({
  platform,
  enabled,
  onChange,
}: {
  platform: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 mb-6 text-sm text-ink">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      Generate captions for {platformLabel(platform)}
    </label>
  )
}
