'use client'
import { useState } from 'react'
import { CaptionMap, InheritedCaption, SocialAccount, tabLabel } from '@/lib/user/compose'
import { PlatformCaptionField } from './PlatformCaptionField'
import { AccountCaptionFields } from './AccountCaptionFields'

/**
 * The caption, with a tab per selected platform. One caption per platform:
 * 280 characters on X and 3,000 on LinkedIn want different text, so the
 * default is a starting point rather than the only option.
 */
export function CaptionEditor({
  caption,
  onCaptionChange,
  selectedPlatforms,
  selectedAccounts,
  platformCaptions,
  platformCaption,
  accountCaption,
  setPlatformOverride,
  setAccountOverride,
}: {
  caption: string
  onCaptionChange: (caption: string) => void
  selectedPlatforms: string[]
  selectedAccounts: SocialAccount[]
  platformCaptions: CaptionMap
  platformCaption: (platform: string) => InheritedCaption
  accountCaption: (accountId: string, platform: string) => InheritedCaption
  setPlatformOverride: (platform: string, value: string | null) => void
  setAccountOverride: (accountId: string, value: string | null) => void
}) {
  const [tab, setTab] = useState('default')

  return (
    <>
      {selectedPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 border-b border-hairline">
          {['default', ...selectedPlatforms].map((key) => (
            <button
              key={key} type="button" onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg -mb-px border-b-2 ${
                tab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {key === 'default' ? 'All platforms' : tabLabel(key)}
              {key !== 'default' && key in platformCaptions ? ' ·' : ''}
            </button>
          ))}
        </div>
      )}

      {tab === 'default' || !selectedPlatforms.includes(tab) ? (
        <textarea
          placeholder="Write a caption…" value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          className="w-full border border-hairline bg-surface rounded-xl px-4 py-3 mb-2 h-28 transition-colors focus:border-primary"
        />
      ) : (
        <div className="mb-2">
          <PlatformCaptionField
            platform={tab}
            current={platformCaption(tab)}
            caption={caption}
            onChange={(value) => setPlatformOverride(tab, value)}
          />
          <AccountCaptionFields
            platform={tab}
            accounts={selectedAccounts.filter((a) => a.platform === tab)}
            accountCaption={accountCaption}
            onChange={setAccountOverride}
          />
        </div>
      )}
    </>
  )
}
