'use client'
import { hasXReplies } from '@/lib/user/compose'
import { useComposeForm } from '@/components/user/compose/useComposeForm'
import { MediaPicker } from '@/components/user/compose/MediaPicker'
import { AccountPicker } from '@/components/user/compose/AccountPicker'
import { CaptionGenerator } from '@/components/user/compose/CaptionGenerator'
import { CaptionEditor } from '@/components/user/compose/CaptionEditor'
import { TargetCounters } from '@/components/user/compose/TargetCounters'
import { XReplies } from '@/components/user/compose/XReplies'
import { SchedulePicker } from '@/components/user/compose/SchedulePicker'
import { SubmitBar } from '@/components/user/compose/SubmitBar'

/**
 * The composer — one post to any number of accounts.
 *
 * State and actions: components/user/compose/useComposeForm.ts.
 * Logic: lib/user/compose.ts. Sections: components/user/compose/.
 */
export default function ComposePage() {
  const form = useComposeForm()

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-bold text-ink mb-6">New post</h1>

      <MediaPicker files={form.files} onChange={form.setFiles} />

      <AccountPicker accounts={form.accounts} selected={form.selected} onToggle={form.toggle} />

      <CaptionGenerator
        selectedPlatforms={form.selectedPlatforms}
        selectedAccounts={form.selectedAccounts}
        platformCaptions={form.platformCaptions}
        onEdit={form.setPlatformOverride}
        brief={form.brief}
        onBriefChange={form.setBrief}
        hasMedia={form.files.length > 0}
        generating={form.generating}
        error={form.generateError}
        quotaLeft={form.quotaLeft}
        onGenerate={form.generateCaptions}
      />

      <CaptionEditor
        caption={form.caption}
        onCaptionChange={form.setCaption}
        selectedPlatforms={form.selectedPlatforms}
        selectedAccounts={form.selectedAccounts}
        platformCaptions={form.platformCaptions}
        platformCaption={form.platformCaption}
        accountCaption={form.accountCaption}
        setPlatformOverride={form.setPlatformOverride}
        setAccountOverride={form.setAccountOverride}
      />

      <TargetCounters targets={form.targets} caption={form.caption} />

      {form.xAccounts.length > 0 && (
        <XReplies
          firstComment={form.firstComment}
          setFirstComment={form.setFirstComment}
          thread={form.thread}
          setThread={form.setThread}
          linksToOffer={form.offeredLinks}
          error={form.replyError}
          hasReplies={hasXReplies(form.xOptions)}
        />
      )}

      <SchedulePicker value={form.scheduleAt} onChange={form.setScheduleAt} />

      <SubmitBar
        message={form.message}
        disabled={form.submitting || form.selected.length === 0 || form.blocked}
        submitting={form.submitting}
        scheduled={!!form.scheduleAt}
        onSubmit={form.handleSubmit}
      />
    </div>
  )
}
