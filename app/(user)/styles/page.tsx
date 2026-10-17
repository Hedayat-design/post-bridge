'use client'
import { useStylesForm } from '@/components/user/styles/useStylesForm'
import { PlatformTabs } from '@/components/user/styles/PlatformTabs'
import { GenerateToggle } from '@/components/user/styles/GenerateToggle'
import { InstructionsField } from '@/components/user/styles/InstructionsField'
import { ExamplePosts } from '@/components/user/styles/ExamplePosts'
import { ModelField } from '@/components/user/styles/ModelField'
import { SaveBar } from '@/components/user/styles/SaveBar'

/**
 * Per-platform caption styles.
 *
 * This page exists so that tuning how a platform sounds never means editing
 * source. Everything here is stored per user, so two people on the same
 * deployment do not share a voice.
 *
 * State: components/user/styles/useStylesForm.ts. Logic: lib/user/styles.ts.
 * Sections: components/user/styles/.
 */
export default function StylesPage() {
  const { styles, platform, setPlatform, loading, saving, message, current, update, save } =
    useStylesForm()

  if (loading) {
    return <div className="max-w-2xl mx-auto px-6 py-16 text-sm text-muted">Loading styles…</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Caption styles</h1>
      <p className="text-sm text-muted mb-8">
        How each platform should sound. Your example posts carry your voice — they
        matter more than any instruction you can write.
      </p>

      <PlatformTabs styles={styles} platform={platform} onSelect={setPlatform} />

      <GenerateToggle
        platform={platform}
        enabled={current.enabled}
        onChange={(enabled) => update({ enabled })}
      />

      <InstructionsField
        value={current.instructions}
        onChange={(instructions) => update({ instructions })}
      />

      <ExamplePosts examples={current.examples} onChange={(examples) => update({ examples })} />

      <ModelField value={current.model} onChange={(model) => update({ model })} />

      <SaveBar platform={platform} message={message} saving={saving} onSave={save} />
    </div>
  )
}
