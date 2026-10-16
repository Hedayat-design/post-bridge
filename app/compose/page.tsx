'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import {
  LIMITS,
  TwitterOptions,
  effectiveTextLimit,
  validateXReplies,
} from '@/lib/adapters/limits'
import { containsLink, extractLinks } from '@/lib/adapters/x-links'
import {
  TargetOverride,
  captionAsPublished,
  preflightResolvedTarget,
  resolveTargetContent,
} from '@/lib/adapters/overrides'

type SocialAccount = {
  id: string
  platform: string
  display_name: string | null
  has_x_premium: boolean | null
}

/** A caption the user typed for one platform or account, as an override map. */
function asConfigurations(captions: Record<string, string>): Record<string, TargetOverride> {
  return Object.fromEntries(Object.entries(captions).map(([key, caption]) => [key, { caption }]))
}

export default function ComposePage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  // Only the keys present here are overrides; a platform or account that isn't
  // listed falls through to the default caption, exactly as the publish route
  // resolves it. An empty string is a deliberate "nothing here", so removing an
  // override means deleting the key, not blanking the text.
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({})
  const [accountCaptions, setAccountCaptions] = useState<Record<string, string>>({})
  const [tab, setTab] = useState('default')
  // X replies. The post body gives its links up to avoid X's surcharge, and
  // the first comment is where they are meant to land; thread entries chain
  // under it. Both are passed through to X rather than resolved away, so they
  // travel in platform_options and not in the caption overrides above.
  const [firstComment, setFirstComment] = useState('')
  const [thread, setThread] = useState<string[]>([])
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

  function setOverride(
    map: Record<string, string>,
    setMap: (next: Record<string, string>) => void,
    key: string,
    value: string | null
  ) {
    const next = { ...map }
    if (value === null) delete next[key]
    else next[key] = value
    setMap(next)
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id))
  const selectedPlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)))

  const platformConfigurations = useMemo(
    () => asConfigurations(platformCaptions),
    [platformCaptions]
  )
  const accountConfigurations = useMemo(() => asConfigurations(accountCaptions), [accountCaptions])

  /**
   * One row per selected account, each measured against *its own* caption and
   * its own limit. A single shared counter was wrong as soon as each platform
   * could carry different text — and it was already approximate, since a
   * Premium X account allows 25,000 characters where a standard one allows 280.
   * The numbers come from the same resolution and validation the server runs,
   * so what the user sees here is what the API will say.
   */
  const targets = selectedAccounts.map((account) => {
    const content = resolveTargetContent({
      platform: account.platform,
      accountId: account.id,
      caption,
      // Media is uploaded on submit, so only its count is known here; the
      // composer doesn't offer per-platform media, so every target gets it.
      mediaUrls: [],
      platformConfigurations,
      accountConfigurations,
    })
    const capabilities = { hasXPremium: account.has_x_premium ?? false }

    return {
      account,
      source: content.captionFrom,
      // X strips links out of the post body before publishing, so the text it
      // measures is shorter than what was typed.
      published: captionAsPublished(account.platform, content.caption),
      // What was typed, before stripping — the links to offer moving.
      typed: content.caption,
      limit: effectiveTextLimit(account.platform, capabilities),
      error: preflightResolvedTarget({
        platform: account.platform,
        caption: content.caption,
        mediaCount: files.length,
        capabilities,
      }),
      strippedALink: account.platform === 'x' && containsLink(content.caption),
    }
  })

  const xAccounts = selectedAccounts.filter((a) => a.platform === 'x')

  const xOptions = useMemo(() => {
    const options: TwitterOptions = {}
    // A blank field means "no first comment"; a blank *thread row* is a row
    // the user added and left empty, which validation below complains about
    // rather than quietly dropping.
    if (firstComment.trim()) options.firstComment = firstComment
    if (thread.length) options.thread = thread
    return options
  }, [firstComment, thread])

  const hasXOptions = xOptions.firstComment !== undefined || xOptions.thread !== undefined

  /**
   * The replies measured against each selected X account, because Premium
   * raises the ceiling for a reply exactly as it does for the post. Same
   * function the API and the adapter use, so the composer cannot disagree
   * with them.
   */
  const xReplyError = hasXOptions
    ? xAccounts
        .map((a) => validateXReplies(xOptions, { hasXPremium: a.has_x_premium ?? false }))
        .find((error) => error !== null) ?? null
    : null

  /** Links X will take out of the post body, offered for the first comment. */
  const strippedLinks = Array.from(
    new Set(
      targets
        .filter((t) => t.account.platform === 'x')
        .flatMap((t) => extractLinks(t.typed))
    )
  )

  // Only the ones not already in the reply, so the offer disappears as it is
  // taken up and a second link does not re-add the first.
  const linksToOffer = strippedLinks.filter((link) => !firstComment.includes(link))

  const blocked = targets.some((t) => t.error !== null) || xReplyError !== null

  /** What a platform tab shows: its own override, or the default it inherits. */
  function platformCaption(platform: string) {
    return platform in platformCaptions
      ? { text: platformCaptions[platform], overridden: true }
      : { text: caption, overridden: false }
  }

  /**
   * What an account field shows. An account inherits its *platform's* caption,
   * not the default one, so turning an account override off lands it back on
   * the text shown in the tab above rather than jumping two levels up.
   */
  function accountCaption(accountId: string, platform: string) {
    return accountId in accountCaptions
      ? { text: accountCaptions[accountId], overridden: true }
      : { text: platformCaption(platform).text, overridden: false }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setMessage('')

    const mediaUrls: string[] = []
    for (const file of files) {
      const path = `${Date.now()}-${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('post-media').upload(path, file)
      if (uploadError) {
        setMessage(uploadError.message)
        setSubmitting(false)
        return
      }
      const { data } = supabase.storage.from('post-media').getPublicUrl(path)
      mediaUrls.push(data.publicUrl)
    }

    const hasVideo = files.some((f) => f.type.startsWith('video'))
    const mediaType = !files.length ? 'text' : hasVideo ? 'video' : files.length > 1 ? 'carousel' : 'image'

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        mediaUrls,
        mediaType,
        // datetime-local yields a naive local string. Converting to a real
        // instant here is what stops posts firing at the wrong hour.
        scheduledFor: scheduleAt ? new Date(scheduleAt).toISOString() : null,
        socialAccountIds: selected,
        // Only the platforms and accounts the user actually customised. An
        // override for something that is no longer selected would be rejected,
        // so drop it rather than sending work the user can't see.
        platformConfigurations: Object.fromEntries(
          Object.entries(platformConfigurations).filter(([p]) => selectedPlatforms.includes(p))
        ),
        accountConfigurations: Object.fromEntries(
          Object.entries(accountConfigurations).filter(([id]) => selected.includes(id))
        ),
        // Only when an X account is actually selected: the API rejects a
        // first comment with nowhere to go, and it would be right to.
        platformOptions: xAccounts.length && hasXOptions ? { x: xOptions } : {},
      }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage(result.error)
      return
    }

    router.push('/dashboard')
  }

  const tabLabel = (platform: string) => LIMITS[platform]?.label ?? platform

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-ink mb-6">Upload to Post Bridge</h1>

      <label className="block border-2 border-dashed border-hairline-strong bg-surface/50 rounded-xl p-8 text-center text-sm text-muted cursor-pointer mb-6 transition-colors hover:border-primary hover:text-primary">
        {files.length === 0
          ? 'Click to choose images or a video'
          : files.map((f) => f.name).join(', ')}
        <input
          type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      <p className="text-sm font-medium text-ink mb-2">Post to</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {accounts.length === 0 && (
          <p className="text-sm text-muted">No connected accounts yet — <a href="/connect" className="text-primary underline underline-offset-2">connect one</a>.</p>
        )}
        {accounts.map((a) => (
          <button
            key={a.id} type="button" onClick={() => toggle(a.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              selected.includes(a.id)
                ? 'bg-primary text-primary-fg border-primary shadow-card'
                : 'border-hairline-strong text-ink hover:border-primary hover:text-primary'
            }`}
          >
            {a.platform}{a.display_name ? ` · ${a.display_name}` : ''}
          </button>
        ))}
      </div>

      {/* One caption per platform: 280 characters on X and 3,000 on LinkedIn
          want different text, so the default is a starting point rather than
          the only option. */}
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
          onChange={(e) => setCaption(e.target.value)}
          className="w-full border border-hairline bg-surface rounded-xl px-4 py-3 mb-2 h-28 transition-colors focus:border-primary"
        />
      ) : (
        <div className="mb-2">
          {(() => {
            const current = platformCaption(tab)
            return (
              <>
                <textarea
                  placeholder={`Caption for ${tabLabel(tab)}…`}
                  value={current.text}
                  readOnly={!current.overridden}
                  onClick={() => {
                    // Clicking an inherited caption starts customising it from
                    // the default text, which is almost always the edit someone
                    // wants — nobody retypes the whole post for one platform.
                    if (!current.overridden) {
                      setOverride(platformCaptions, setPlatformCaptions, tab, caption)
                    }
                  }}
                  onChange={(e) =>
                    setOverride(platformCaptions, setPlatformCaptions, tab, e.target.value)
                  }
                  className={`w-full border border-hairline rounded-xl px-4 py-3 h-28 transition-colors focus:border-primary ${
                    current.overridden ? 'bg-surface' : 'bg-sunken text-muted'
                  }`}
                />
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-faint">
                    {current.overridden
                      ? `Only ${tabLabel(tab)} gets this text.`
                      : `Using the caption from All platforms — click to customise.`}
                  </span>
                  {current.overridden && (
                    <button
                      type="button"
                      className="underline underline-offset-2 text-primary"
                      onClick={() =>
                        setOverride(platformCaptions, setPlatformCaptions, tab, null)
                      }
                    >
                      Use the default
                    </button>
                  )}
                </div>
              </>
            )
          })()}

          {/* Two accounts on one platform can want different text — a personal
              and a company handle, say — which is why overrides are keyed by
              account as well. Only shown when there is a choice to make. */}
          {selectedAccounts.filter((a) => a.platform === tab).length > 1 &&
            selectedAccounts
              .filter((a) => a.platform === tab)
              .map((a) => {
                const current = accountCaption(a.id, tab)
                return (
                  <div key={a.id} className="mt-3 border-l-2 border-hairline pl-3">
                    <p className="text-xs font-medium text-ink mb-1">
                      {a.display_name ?? a.id.slice(0, 8)}
                      {current.overridden ? '' : ' — inherits the caption above'}
                    </p>
                    {current.overridden ? (
                      <>
                        <textarea
                          value={current.text}
                          onChange={(e) =>
                            setOverride(accountCaptions, setAccountCaptions, a.id, e.target.value)
                          }
                          className="w-full border border-hairline bg-surface rounded-xl px-3 py-2 h-20 text-sm transition-colors focus:border-primary"
                        />
                        <button
                          type="button"
                          className="text-xs underline underline-offset-2 text-primary"
                          onClick={() =>
                            setOverride(accountCaptions, setAccountCaptions, a.id, null)
                          }
                        >
                          Use the {tabLabel(tab)} caption
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-xs underline underline-offset-2 text-primary"
                        onClick={() =>
                          setOverride(accountCaptions, setAccountCaptions, a.id, current.text)
                        }
                      >
                        Customise for this account
                      </button>
                    )}
                  </div>
                )
              })}
        </div>
      )}

      {/* Each account against its own limit. A single minimum across platforms
          stopped being meaningful once every platform can carry its own text. */}
      <div className="mb-6 space-y-0.5">
        {targets.length === 0 && (
          <p className="text-xs text-faint">{caption.length} characters</p>
        )}
        {targets.map((t) => (
          <p
            key={t.account.id}
            className={`text-xs ${t.error ? 'text-danger' : 'text-muted'}`}
          >
            {tabLabel(t.account.platform)}
            {t.account.display_name ? ` · ${t.account.display_name}` : ''}{' '}
            {t.published.length} / {t.limit}
            {t.source !== 'post' ? ` · own caption` : ''}
            {t.strippedALink ? ' · link removed' : ''}
            {t.error ? ` — ${t.error}` : ''}
          </p>
        ))}
        {targets.some((t) => t.strippedALink) && (
          <p className="text-xs text-warning pt-1">
            Links are removed from the X post — X demotes posts that carry one.
            Other platforms keep it.
          </p>
        )}
      </div>

      {/* The other half of link stripping. The post body cannot carry a link
          without X demoting it, so the link goes in a reply instead — and
          replies keep their links. Thread entries chain on under it. */}
      {xAccounts.length > 0 && (
        <div className="border border-accent/30 bg-accent-soft/40 rounded-2xl p-4 mb-6">
          <p className="text-sm font-medium text-ink mb-1">X reply</p>

          {linksToOffer.length > 0 && (
            <button
              type="button"
              onClick={() =>
                // Append rather than replace: the user may have written the
                // reply already and only be missing the link.
                setFirstComment((current) =>
                  [current.trim(), linksToOffer.join(' ')].filter(Boolean).join(' ')
                )
              }
              className="text-xs font-medium text-primary underline underline-offset-2 mb-2 block text-left"
            >
              Put {linksToOffer.length > 1 ? 'the removed links' : 'the removed link'} in the
              first comment
            </button>
          )}

          <textarea
            placeholder="First comment — posted as a reply once the tweet is live. Links are kept here."
            value={firstComment}
            onChange={(e) => setFirstComment(e.target.value)}
            className="w-full border border-hairline bg-surface rounded-xl px-3 py-2 h-20 text-sm transition-colors focus:border-primary"
          />

          {thread.map((entry, i) => (
            <div key={i} className="flex gap-2 mt-2">
              <textarea
                placeholder={`Thread entry ${i + 1}`}
                value={entry}
                onChange={(e) =>
                  setThread(thread.map((t, j) => (j === i ? e.target.value : t)))
                }
                className="flex-1 border border-hairline bg-surface rounded-xl px-3 py-2 h-16 text-sm transition-colors focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setThread(thread.filter((_, j) => j !== i))}
                className="text-xs text-muted underline underline-offset-2 self-start pt-2 transition-colors hover:text-danger"
              >
                Remove
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={() => setThread([...thread, ''])}
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              + Add a thread entry
            </button>
            <span className="text-xs text-muted">
              {firstComment.trim() || thread.length
                ? `${(firstComment.trim() ? 1 : 0) + thread.length} ${
                    (firstComment.trim() ? 1 : 0) + thread.length === 1 ? 'reply' : 'replies'
                  } under the post`
                : 'No replies'}
            </span>
          </div>

          {xReplyError && <p className="text-xs text-danger mt-2">{xReplyError}</p>}

          {/* A reply is posted after the tweet is live, so it can fail on its
              own. Saying so here beats a surprise on the dashboard. */}
          {!xReplyError && hasXOptions && (
            <p className="text-xs text-muted mt-2">
              Replies go out after the post itself. If one fails the post still
              stands, and the dashboard shows which reply did not.
            </p>
          )}
        </div>
      )}

      <label className="block text-sm font-medium text-ink mb-2">Schedule for later (optional)</label>
      <input
        type="datetime-local" value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
        className="w-full border border-hairline bg-surface rounded-xl px-4 py-2.5 mb-2 transition-colors focus:border-primary"
      />
      {scheduleAt && (
        <p className="text-xs text-muted mb-6">
          Posts at {new Date(scheduleAt).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </p>
      )}

      {message && <p className="text-sm text-danger bg-danger-soft border border-danger/25 rounded-xl px-4 py-3 mb-4 whitespace-pre-wrap">{message}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || selected.length === 0 || blocked}
        className="w-full bg-primary text-primary-fg font-semibold py-3 rounded-xl shadow-card transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary"
      >
        {submitting ? 'Publishing…' : scheduleAt ? 'Schedule post' : 'Post now'}
      </button>
    </div>
  )
}
