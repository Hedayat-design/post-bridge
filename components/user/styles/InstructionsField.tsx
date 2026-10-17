/** The free-text instructions for one platform's voice. */
export function InstructionsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <>
      <label className="block text-sm font-medium text-ink mb-2">Instructions</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Who you're writing for, the angle you take, words you never use…"
        className="w-full border border-hairline bg-surface rounded-xl px-4 py-3 h-32 text-sm mb-1 transition-colors focus:border-primary"
      />
      <p className="text-xs text-faint mb-6">
        These take priority over our platform defaults. {value.length} characters.
      </p>
    </>
  )
}
