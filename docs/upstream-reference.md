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

Items 2, 3 and 4 are **done** — see `lib/adapters/limits.ts`,
`lib/adapters/x-links.ts` and `tests/platform-rules.test.ts`.

### 1. Per-platform and per-account overrides
Their `CreatePostDto` carries `platform_configurations` (keyed by platform) and
`account_configurations` (keyed by `account_id`). Each can override `caption`
and `media`. This is their headline "customize per platform" feature and we have
nothing equivalent — we send one caption everywhere.

Suggested: `platform_configurations jsonb` and `account_configurations jsonb` on
`posts`, resolved at publish time as account override → platform override → post default.

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
because of a long URL now publishes. Still to add: `first_comment`, so the
stripped link has somewhere to go.

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
