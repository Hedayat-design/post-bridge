# Post Bridge (clone) — full stack

Next.js 14 (App Router) + Supabase (auth, DB, storage) + Stripe (billing).
Multi-platform posting/scheduling, connected accounts with plan limits,
compose/upload flow, dashboard, pricing/billing.

## Platform status

| Platform | Connect (OAuth) | Publish |
|---|---|---|
| X | ✅ PKCE, token refresh | ✅ text, up to 4 images, 1 video (chunked upload) |
| LinkedIn | ✅ OIDC | ✅ text, single/multi image, video (multipart upload) |
| Instagram | ⏳ | ⏳ not implemented |
| Facebook | ⏳ | ⏳ not implemented |
| TikTok | ⏳ | ⏳ not implemented |
| YouTube | ⏳ | ⏳ not implemented |

Unimplemented platforms are hidden behind a "Coming soon" badge on `/connect`
and return an explicit error if reached — they never report a false success.

## 1. Setup

```bash
npm install
cp .env.example .env.local   # fill in every value
```

Generate the two internal secrets:

```bash
openssl rand -hex 32   # OAUTH_STATE_SECRET
openssl rand -hex 32   # INTERNAL_API_SECRET
```

## 2. Database

In your Supabase project's SQL editor, run in order:

1. `supabase/schema.sql`
2. `supabase/migrations/0002_profile_trigger_and_indexes.sql`

The second one is **required** — it creates the trigger that inserts a
`profiles` row on signup. Without it, connecting a social account fails on a
foreign-key violation.

Also create a public Storage bucket named `post-media` (Storage → New bucket).

## 3. Stripe

Create 3 recurring Prices in the Stripe dashboard ($29/$49/$99 monthly) and put
their price IDs into `.env.local`. Point a webhook at `/api/webhooks/stripe`
listening for `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`.

## 4. Platform developer apps

### X
1. developer.x.com → create a Project + App.
2. Set up **OAuth 2.0**, type **Web App / Confidential client**.
3. Callback URL: `https://<your-domain>/api/oauth/x/callback`
4. Scopes: `tweet.read tweet.write users.read media.write offline.access`
5. Copy the OAuth 2.0 Client ID and Secret into `.env.local`.

`media.write` is required for any post carrying an image or video, and
`offline.access` is what returns a refresh token.

### LinkedIn
1. linkedin.com/developers → create an app, associate a Company Page.
2. Request the **Share on LinkedIn** and **Sign In with LinkedIn using OpenID
   Connect** products.
3. Redirect URL: `https://<your-domain>/api/oauth/linkedin/callback`
4. Scopes: `openid profile email w_member_social`

LinkedIn versions its REST API by month (`LINKEDIN_API_VERSION`, default
`202506`). Versions age out — bump it periodically.

## 5. Cron (scheduled posts)

`vercel.json` already defines the schedule. Set `CRON_SECRET` in the Vercel
dashboard; Vercel sends it as a bearer token automatically.

Each run claims at most 20 due posts, flipping `scheduled → posting`
conditionally so two overlapping runs can't publish the same post twice.

## 6. Run locally

```bash
npm run dev
```

## Structure

- `app/` — pages + API routes (App Router)
- `lib/adapters/` — one file per platform's publish logic
- `lib/oauth.ts` — PKCE + signed OAuth state
- `lib/tokens.ts` — refresh-before-publish
- `lib/media.ts` — downloads media to bytes for upload
- `lib/platforms.ts` — OAuth config + plan limits
- `supabase/` — schema and migrations

## Security notes

- `/api/publish` runs with service-role credentials and is gated by
  `INTERNAL_API_SECRET`. Never expose it publicly.
- OAuth state is an opaque nonce; the user id and PKCE verifier live in an
  HMAC-signed httpOnly cookie.

## Still to harden before production

- **Access tokens are stored in plaintext** in `social_accounts.access_token`.
  Encrypt with Supabase Vault before real use.
- `next@14.2.5` has a published security advisory — upgrade.
- No Stripe billing portal, and `customer.subscription.updated` doesn't map
  price → plan, so plan changes made in Stripe don't sync back.
- `/pricing/manage` is protected in middleware but the page doesn't exist.
- No way to edit, delete, cancel, or retry a post from the dashboard.
- Stripe webhooks aren't idempotent; replays double-apply.
- `posts.expires_at` exists but nothing cleans up expired media.
