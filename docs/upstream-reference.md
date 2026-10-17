# Upstream reference: how post-bridge.com is actually built

Research notes from studying the live product at https://www.post-bridge.com/,
its agent offering at `/agents`, and its **public** OpenAPI spec at
https://api.post-bridge.com/openapi.json (saved at `../reference/postbridge-openapi.json`).

Everything here came from public pages and a published API spec. No account, no
auth bypass. We reimplement designs in our own code; we do not copy theirs.

## Their stack

Next.js App Router on Vercel — same as ours. Route groups `(marketing)` and
`(auth)`, pages `/agents`, `/pricing`, `/tools`, `/blog`, `/growth-guide`,
`/signin`. API is a separate service on `api.post-bridge.com`, documented with
Scalar, auth via `bearer` (API key) and `mcp-oauth`.

## What we already got right

- **Per-platform result rows.** Our `post_targets` table is essentially their
  `/v1/post-results` resource: one row per account, independent success/failure,
  platform post id, error message. Their docs confirm the model — "each platform
  posts independently. If one fails, the others still go through."
- Shared limits module validating before publish (`lib/adapters/limits.ts`).
- Next.js + Vercel cron for scheduled posts.
- `social_accounts` already allows multiple accounts per platform.

## Gaps, highest value first

Items 1, 2, 3 and 4 are **done** — see `lib/adapters/limits.ts`,
`lib/adapters/overrides.ts`, `lib/adapters/x-links.ts`,
`tests/platform-rules.test.ts` and `tests/overrides.test.ts`.

### 1. Per-platform and per-account overrides — DONE
Their `CreatePostDto` carries `platform_configurations` (keyed by platform) and
`account_configurations` (keyed by `account_id`). Each can override `caption`
and `media`. This is their headline "customize per platform" feature, and we
used to send one caption everywhere.

Now `posts.platform_configurations` and `posts.account_configurations`
(migration 0005) carry the overrides, and `lib/adapters/overrides.ts` resolves
one target's content as account override → platform override → the post's own.
Each field falls through on its own, so an account that overrides only its
caption still takes its platform's media.

Decisions worth keeping in mind:

- **Separate columns, not `platform_options`.** Upstream merges the two — their
  `TwitterConfiguration` holds `caption` and `media` next to `first_comment`.
  Ours stay apart because `platform_options` is passed *through* to the platform
  API while an override is resolved *away* before the adapter is called; merging
  them would give every adapter two sources of truth for the caption.
  `account_configurations` is keyed by account id and could not have lived in a
  platform-keyed column anyway.
- **Validation runs on the resolved caption**, and for X after link stripping —
  `captionAsPublished` is the one place that knows a platform rewrites text on
  the way out. Validating the post's default instead would reject posts that are
  fine and accept ones X will refuse.
- **`""` and `[]` are real overrides**, not absences, so "text on X, image-only
  on Instagram" is expressible. Only a missing or wrongly-typed value falls
  through; the configurations come from jsonb, so anything unexpected in there
  resolves to the post's own value rather than publishing junk.
- **Media is resolved too**, including in the publish route, which now downloads
  the union of every target's URLs and derives each target's `mediaType` from
  what that target actually sends. The composer exposes per-platform *captions*
  only; per-platform media is supported by the schema, the API and resolution,
  but has no UI yet.
- Our `account_configurations` is an object keyed by our account uuid, where
  upstream sends an array of `{account_id, ...}` — an object cannot carry the
  same account twice with conflicting overrides.

### 2. Platform compliance toggles — DONE (correctness, not polish)
Their per-platform configs expose disclosures the platforms **require**:

- TikTok: `is_aigc` (AI-generated label), `disclose_branded_content`,
  `disclose_your_brand`, `privacy_status`, `allow_comment/duet/stitch`
- YouTube: `contains_synthetic_media`, `has_paid_product_placement`, `tags`, `thumbnail`
- Instagram: `placement` (story), `collaborators`, `user_tags`, `cover_image`,
  `share_to_feed`, `is_trial_reel`

Publishing to TikTok/YouTube without the AI-content and paid-promotion
disclosures can put our users in breach of platform policy. Treat as required
before those adapters ship, not as a later feature.

Implemented as `TiktokOptions` / `YoutubeOptions` in `lib/adapters/limits.ts`,
carried on `PublishInput.platformOptions` and persisted in `posts.platform_options`.
`validatePlatformOptions` enforces the combinations the platforms reject
(branded content on a private TikTok post, Duet/Stitch on a photo post,
YouTube's 500-character tag cap). The real TikTok and YouTube adapters are still
stubs, but mock mode exercises these rules today, so the adapters cannot be
built without them.

### 3. X character limit is wrong for Premium — DONE
Their `SocialAccountDto` has `has_x_premium`: Premium accounts allow **25,000**
characters, not 280. Our `limits.ts` hardcoded `textLimit: 280`, so we rejected
valid posts.

Now `effectiveTextLimit(platform, capabilities)` resolves the ceiling per
account, backed by `social_accounts.has_x_premium` (migration 0003) and read
from X's `subscription_type` on connect. The compose counter uses the same
function, replacing a second hardcoded `{ x: 280 }` map that had drifted out of
step with the adapters. Detection is best-effort and falls back to 280: X
answers 400 for an unrecognised `user.field`, and that must not be able to break
account connection.

### 4. Links stripped from X captions — DONE
Their create-post endpoint strips URLs (full and bare domains) from X captions
before publishing, "because X charges far more for posts that contain a link",
and advises putting the link in a reply instead. Pairs with their X
`first_comment` and `thread[]` support. Real domain knowledge we lacked.

`lib/adapters/x-links.ts` now does this for X only. Bare domains match an
explicit TLD list rather than a generic "dot something" pattern: prose is full
of things a loose regex reads as a domain ("Node.js", "e.g.", "P.S. Come in"),
and silently eating words out of a caption is worse than leaving a link in. The
caption is stripped *before* it is measured, so a post that only exceeded 280
because of a long URL now publishes.

### 4b. X `first_comment` and `thread` — DONE
The other half of link stripping: somewhere for the stripped URL to go.
`TwitterOptions` in `lib/adapters/limits.ts` carries `firstComment` and
`thread[]`, and `plannedXReplies` turns them into the chain **main tweet →
first comment → thread[0] → thread[1] …**. The real adapter, the mock adapter
and the validator all read that one planner, so demo mode cannot order or
label replies differently from live.

Three decisions worth recording:

- **Links are kept in replies.** The main tweet gives its URL up to dodge X's
  surcharge; the first comment is where it lands. Stripping there would defeat
  the entire feature.
- **Over-long replies are rejected, not trimmed.** Upstream's spec says it
  "trims to the character limit". We reject, for the same reason this file
  gives above for the TLD list: silently cutting the end off someone's
  sentence is worse than telling them it does not fit, and the main caption is
  already rejected rather than trimmed. Every reply is measured with
  `effectiveTextLimit`, so Premium raises the reply ceiling too. (Their spec
  says 2,200 for a Premium first comment but 25,000 for a Premium thread
  entry; those cannot both be right, and 25,000 matches the documented Premium
  post limit, so we use it for both.)
- **The chain stops at the first failure** rather than skipping ahead. A reply
  pointed at a tweet that was never created detaches from the thread and reads
  as a stray post.

### Partial publishes
Replies are separate tweets posted *after* the main one is live, and a live
tweet cannot be unsent. `post_targets.status` could not express that: `failed`
hides a published post and invites a retry that double-posts, while `posted`
drops the reply error on the floor. Migration
`0006_partial_post_targets.sql` adds a fourth value, `partial` — the post is
live, `platform_post_id` is real, and `error_message` holds the reply failure.
Post-level status counts it as published, because it is, and `/api/publish`
returns its own `partial` count so `/api/posts` cannot report a live tweet as
"Publishing failed". `PublishResult` grew `replyPostIds` and
`partialErrorMessage` to carry this out of the adapters.

### Reaching it from the UI — DONE
`posts.platform_options` was a write-only column: `/api/posts` never set it, so
nothing in compose could reach `first_comment`, `thread`, or the TikTok and
YouTube disclosures from item 2. `/api/posts` now accepts `platformOptions`,
and `sanitizePlatformOptions` in `limits.ts` decides what is *storable* before
it lands in the jsonb column — a separate job from `validatePost`, which
decides what is *publishable*.

Sanitizing drops wrongly-typed values rather than coercing them, and drops a
`thread` whole if any entry is not a string, on the same reasoning the caption
overrides use for media: publishing a *subset* of someone's thread is a
silently wrong post, where dropping it leaves a single tweet they can see went
out alone. Unlike the overrides, these options are passed to the platform
verbatim, so this is the last point a bad value can be caught.

Compose grew an **X reply** panel, shown only when an X account is selected,
with the first comment, add/remove thread entries, and the reply count. Two
things it does deliberately:

- **It offers to move the stripped link.** `extractLinks` in `x-links.ts` runs
  the same three patterns in the same order as `stripLinks`, through one shared
  `removeLinks` — so what the composer offers to move and what the post gives
  up are the same set by construction, not two regex lists kept in step by
  hand. Only links not already in the reply are offered, and taking the offer
  appends rather than replaces.
- **It validates with `validateXReplies`,** the same function the API and the
  adapter call, measured against each selected X account because Premium
  raises the reply ceiling too. The composer therefore cannot disagree with
  what the server will say, and it tells the user up front that a failed reply
  leaves the post standing.

`/api/posts` also rejects a first comment written with no X account selected —
the same reasoning as a stray caption override: it would silently never be
posted, and the user would wonder why their link never appeared.

### Beyond upstream: AI caption generation
Not a gap we copied — upstream has no equivalent. A post's image is sent to a
vision model through OpenRouter and each selected platform gets its own
caption, written in the user's voice.

- **The voice lives in the database**, per user and per platform
  (`platform_styles`, migration 0007), edited at `/styles`. Prompts in source
  would mean a deploy per adjustment and one shared voice for everybody.
- **Examples over adjectives.** A model told to "write like a top performer"
  produces the average of the internet. The user's own posts are the only
  thing that reliably carries a voice, so examples are the primary input and
  the instructions are a steer on top. `lib/ai/prompt.ts` orders the system
  prompt so the user's instructions come *after* our platform note, because
  when the two disagree the user's wording should be what the model read last.
- **Generated captions are ordinary platform overrides.** They are written
  into `platform_configurations`, so a generated caption is validated,
  edited and published by exactly the same path as one typed by hand, and the
  publish route needed no changes at all.
- **The model is per platform**, a plain OpenRouter slug on each style row, so
  a long-form LinkedIn post and a 280-character tweet can use different models
  and either can be swapped without a deploy.
- **Cost is capped per plan.** Generation bills to the app's own OpenRouter
  key, so `caption_generations` logs every attempt and the month's row count
  is the cap (`lib/ai/quota.ts`). Failed attempts count: they cost tokens
  upstream, and excluding them would make a broken model slug a free
  unlimited loop.
- **Nothing generates or publishes on its own.** Generation is on a button and
  every caption is read by a human before it posts.

### 5. Media as a first-class resource
They have `/v1/media` with `POST /v1/media/create-upload-url`
(`mime_type`, `size_bytes`, `name`) — the client uploads straight to storage and
then references a `media_id`. Posts take `media: [id]` or `media_urls: [url]`.
We store `media_urls text[]` directly on `posts`, so media can't be reused,
listed or deleted independently. Their `processing_enabled` flag also controls
video transcoding per post.

### 6. Connect-link flow for client accounts
`POST /v1/social-accounts/connect-link` takes `platform`, `return_url`,
`external_ref`, `expires_in` and returns a shareable link. The account owner
approves on the platform's own consent screen, and `external_ref` is stored on
the resulting account. This is how agencies onboard client accounts without
sharing logins — we only support a direct OAuth redirect for the logged-in user.

### 7. Dead-token circuit breaker
`needs_reconnect` pauses posting to an account after repeated dead-token
failures (Meta especially) and skips it until reconnected. We refresh tokens
before publish but retry blindly forever.

### 8. Queue slots
`use_queue` auto-schedules to the next free slot, accepting `true` or
`{ timezone }`, and is mutually exclusive with `scheduled_at`. We only support
an explicit timestamp.

### 9. Public REST API + API keys + MCP
A `/v1` API with API keys, 16 MCP tools over OAuth, a CLI (`npx postbridge-cli`)
and an installable agent skill. For them this is a product pillar, priced into
every plan. We have no external API at all.

### 10. Analytics
`/v1/analytics` with `/sync`, `/{id}`, `/{id}/daily`, modelled as daily
snapshots plus deltas (`AnalyticsDailySnapshotDto`, `AnalyticsDailyDeltaDto`).
Still beta on their side.

## Model differences worth copying

**Draft is a boolean, not a status.** Their `status` is
`posted | scheduled | processing | failed`, with `is_draft` separate. Ours folds
`draft` into the status enum, so "a scheduled draft" is unrepresentable. They
also return `warnings[]` on drafts, and a `dashboard_url` on every post.

**Platform coverage.** They support 10: X, Instagram, LinkedIn, Facebook,
TikTok, YouTube, Bluesky, Threads, Pinterest, Google Business. Our `platform`
check constraint allows 6 and omits Bluesky, Threads, Pinterest and Google
Business. Bluesky and Threads are the cheapest wins — no review queue.

**Pricing.** Two tiers, metered on account count: Marketer $39/mo (15 accounts),
Operator $99/mo (99 accounts, +$1 each beyond), unlimited posts on both, 7-day
trial, yearly = 2 months free. Free tier is 5 posts. Ours is four tiers
($29/$49/$99) metered on accounts but with different numbers — theirs is simpler
and anchors on "one business across every platform" at 15.
