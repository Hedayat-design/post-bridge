import { PLATFORMS, Style, isConfigured, platformLabel } from '@/lib/user/styles'

/** One tab per platform, with a gold dot on each that has a voice set. */
export function PlatformTabs({
  styles,
  platform,
  onSelect,
}: {
  styles: Record<string, Style>
  platform: string
  onSelect: (platform: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 mb-6 border-b border-hairline">
      {PLATFORMS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-t-lg -mb-px border-b-2 transition-colors ${
            platform === key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {platformLabel(key)}
          {/* A gold dot marks a platform that has a voice set, so an
              unconfigured one is obvious without opening each tab. */}
          {isConfigured(styles[key]) && <span className="ml-1.5 text-accent">•</span>}
        </button>
      ))}
    </div>
  )
}
