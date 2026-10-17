/** The drop box for images or a video. Files upload on generate or submit, not here. */
export function MediaPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  return (
    <label className="block border-2 border-dashed border-hairline-strong bg-surface/50 rounded-xl p-8 text-center text-sm text-muted cursor-pointer mb-6 transition-colors hover:border-primary hover:text-primary">
      {files.length === 0
        ? 'Click to choose images or a video'
        : files.map((f) => f.name).join(', ')}
      <input
        type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
      />
    </label>
  )
}
