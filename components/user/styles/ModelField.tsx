import { DEFAULT_MODEL } from '@/lib/ai/models'

/** The OpenRouter model for this platform; blank means DEFAULT_MODEL. */
export function ModelField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <>
      <label className="block text-sm font-medium text-ink mb-2">Model</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={DEFAULT_MODEL}
        className="w-full border border-hairline bg-surface rounded-xl px-4 py-2.5 text-sm mb-1 transition-colors focus:border-primary"
      />
      <p className="text-xs text-faint mb-8">
        Any OpenRouter model slug. It has to accept images. Blank uses{' '}
        <code className="text-muted">{DEFAULT_MODEL}</code>.
      </p>
    </>
  )
}
