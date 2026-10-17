/** "Schedule for later": a local date and time, echoed back with the time zone. */
export function SchedulePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <>
      <label className="block text-sm font-medium text-ink mb-2">Schedule for later (optional)</label>
      <input
        type="datetime-local" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-hairline bg-surface rounded-xl px-4 py-2.5 mb-2 transition-colors focus:border-primary"
      />
      {value && (
        <p className="text-xs text-muted mb-6">
          Posts at {new Date(value).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </p>
      )}
    </>
  )
}
