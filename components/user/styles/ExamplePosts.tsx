/** Example posts in the user's voice: add, edit, remove. */
export function ExamplePosts({
  examples,
  onChange,
}: {
  examples: string[]
  onChange: (examples: string[]) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-ink">Example posts</label>
        <span className="text-xs text-faint">{examples.length} saved</span>
      </div>
      <p className="text-xs text-muted mb-3">
        Paste posts you are happy with. The model matches their voice and rhythm,
        not their subject.
      </p>

      {examples.map((example, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <textarea
            value={example}
            onChange={(e) => onChange(examples.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Example ${i + 1}`}
            className="flex-1 border border-hairline bg-surface rounded-xl px-3 py-2 h-24 text-sm transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => onChange(examples.filter((_, j) => j !== i))}
            className="text-xs text-muted underline underline-offset-2 self-start pt-2 transition-colors hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...examples, ''])}
        className="text-xs font-medium text-primary underline underline-offset-2 mb-6 block"
      >
        + Add an example post
      </button>
    </>
  )
}
