'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import {
  CaptionMap,
  SocialAccount,
  accountCaption,
  asConfigurations,
  composeMediaType,
  composeTargets,
  linksToOffer,
  platformCaption,
  postRequestBody,
  tabLabel,
  withOverride,
  xReplyError,
  xReplyOptions,
} from '@/lib/user/compose'

/**
 * The composer's state and actions: everything the sections share, plus the
 * three things that touch the network (media upload, caption generation,
 * submit). The logic itself is in lib/user/compose.ts.
 */
export function useComposeForm() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  // Only the keys present here are overrides; a platform or account that isn't
  // listed falls through to the default caption, exactly as the publish route
  // resolves it. An empty string is a deliberate "nothing here", so removing an
  // override means deleting the key, not blanking the text.
  const [platformCaptions, setPlatformCaptions] = useState<CaptionMap>({})
  const [accountCaptions, setAccountCaptions] = useState<CaptionMap>({})
  // X replies. The post body gives its links up to avoid X's surcharge, and
  // the first comment is where they are meant to land; thread entries chain
  // under it. Both are passed through to X rather than resolved away, so they
  // travel in platform_options and not in the caption overrides above.
  const [firstComment, setFirstComment] = useState('')
  const [thread, setThread] = useState<string[]>([])
  // Caption generation. Media has to reach a public URL before a model can
  // look at it, so the upload that normally happens on submit is pulled
  // forward on the first generate and the URLs reused from then on.
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [brief, setBrief] = useState('')
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [scheduleAt, setScheduleAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = supabaseBrowser()

  useEffect(() => {
    supabase
      .from('social_accounts')
      .select('id, platform, display_name, has_x_premium')
      .then(({ data }) => {
        if (data) setAccounts(data)
      })
  }, [])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const setPlatformOverride = (platform: string, value: string | null) =>
    setPlatformCaptions(withOverride(platformCaptions, platform, value))
  const setAccountOverride = (accountId: string, value: string | null) =>
    setAccountCaptions(withOverride(accountCaptions, accountId, value))

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id))
  const selectedPlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)))

  const platformConfigurations = useMemo(
    () => asConfigurations(platformCaptions),
    [platformCaptions]
  )
  const accountConfigurations = useMemo(() => asConfigurations(accountCaptions), [accountCaptions])

  const targets = composeTargets({
    accounts: selectedAccounts,
    caption,
    platformConfigurations,
    accountConfigurations,
    mediaCount: files.length,
  })

  const xAccounts = selectedAccounts.filter((a) => a.platform === 'x')
  const xOptions = useMemo(() => xReplyOptions(firstComment, thread), [firstComment, thread])
  const replyError = xReplyError(xAccounts, xOptions)
  const offeredLinks = linksToOffer(targets, firstComment)

  const blocked = targets.some((t) => t.error !== null) || replyError !== null

  /**
   * Uploads the chosen files and returns their public URLs, reusing anything
   * already uploaded. Generating and then posting would otherwise upload the
   * same image twice and leave an orphan behind.
   */
  async function ensureUploaded(): Promise<string[] | null> {
    if (uploadedUrls.length === files.length && files.length > 0) return uploadedUrls

    const urls: string[] = []
    for (const file of files) {
      const path = `${Date.now()}-${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('post-media').upload(path, file)
      if (uploadError) {
        setMessage(uploadError.message)
        return null
      }
      const { data } = supabase.storage.from('post-media').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    setUploadedUrls(urls)
    return urls
  }

  /**
   * Writes one caption per selected account and drops each into that
   * platform's override, so a generated caption is an ordinary per-platform
   * caption from that point on — editable, validated and published by exactly
   * the same path as one typed by hand.
   */
  async function generateCaptions(onlyPlatform?: string) {
    setGenerating(true)
    setGenerateError('')
    setMessage('')

    const urls = await ensureUploaded()
    if (!urls) {
      setGenerating(false)
      return
    }

    const ids = onlyPlatform
      ? selectedAccounts.filter((a) => a.platform === onlyPlatform).map((a) => a.id)
      : selected

    const res = await fetch('/api/captions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socialAccountIds: ids, imageUrls: urls, brief }),
    })
    const data = await res.json().catch(() => ({}))
    setGenerating(false)

    if (!res.ok) {
      setGenerateError(data.error ?? 'Could not generate captions')
      return
    }

    // Written as platform overrides, which is what the tabs already read and
    // what /api/posts already persists.
    const next = { ...platformCaptions }
    for (const caption of data.captions ?? []) next[caption.platform] = caption.text
    setPlatformCaptions(next)

    if (typeof data.quota?.remaining === 'number') setQuotaLeft(data.quota.remaining)
    if (data.failures?.length) {
      setGenerateError(
        data.failures.map((f: any) => `${tabLabel(f.platform)}: ${f.error}`).join('\n')
      )
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setMessage('')

    const mediaUrls = (await ensureUploaded()) ?? []
    if (files.length && !mediaUrls.length) {
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        postRequestBody({
          caption,
          mediaUrls,
          mediaType: composeMediaType(files),
          scheduleAt,
          selected,
          selectedPlatforms,
          platformConfigurations,
          accountConfigurations,
          xOptions,
          hasXAccount: xAccounts.length > 0,
        })
      ),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage(result.error)
      return
    }

    router.push('/dashboard')
  }

  return {
    accounts,
    selected,
    toggle,
    selectedAccounts,
    selectedPlatforms,
    files,
    setFiles,
    caption,
    setCaption,
    platformCaptions,
    setPlatformOverride,
    setAccountOverride,
    platformCaption: (platform: string) => platformCaption(platformCaptions, caption, platform),
    accountCaption: (accountId: string, platform: string) =>
      accountCaption(accountCaptions, platformCaptions, caption, accountId, platform),
    targets,
    xAccounts,
    firstComment,
    setFirstComment,
    thread,
    setThread,
    xOptions,
    replyError,
    offeredLinks,
    brief,
    setBrief,
    generating,
    generateError,
    quotaLeft,
    generateCaptions,
    scheduleAt,
    setScheduleAt,
    submitting,
    message,
    blocked,
    handleSubmit,
  }
}

export type ComposeForm = ReturnType<typeof useComposeForm>
