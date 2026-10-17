import { InheritedCaption, tabLabel } from '@/lib/user/compose'

/**
 * One platform tab's caption: read-only while it inherits the default, its
 * own text once customised, with a way back to the default.
 */
export function PlatformCaptionField({
  platform,
  current,
  caption,
  onChange,
}: {
  platform: string
  current: InheritedCaption
  /** The default caption, which an inherited field starts from. */
  caption: string
  /** A new text, or null to drop the override. */
  onChange: (value: string | null) => void
}) {
  return (
    <>
      <textarea
        placeholder={`Caption for ${tabLabel(platform)}…`}
        value={current.text}
        readOnly={!current.overridden}
        onClick={() => {
          // Clicking an inherited caption starts customising it from
          // the default text, which is almost always the edit someone
          // wants — nobody retypes the whole post for one platform.
          if (!current.overridden) {
            onChange(caption)
          }
        }}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-hairline rounded-xl px-4 py-3 h-28 transition-colors focus:border-primary ${
          current.overridden ? 'bg-surface' : 'bg-sunken text-muted'
        }`}
      />
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-faint">
          {current.overridden
            ? `Only ${tabLabel(platform)} gets this text.`
            : `Using the caption from All platforms — click to customise.`}
        </span>
        {current.overridden && (
          <button
            type="button"
            className="underline underline-offset-2 text-primary"
            onClick={() => onChange(null)}
          >
            Use the default
          </button>
        )}
      </div>
    </>
  )
}
