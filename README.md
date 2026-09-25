# Post Bridge (clone) — full stack

Next.js 14 (App Router) + Supabase (auth, DB, storage) + Stripe (billing).
Replicates: multi-platform posting/scheduling, connected accounts with plan limits,
compose/upload flow, dashboard, pricing/billing.

## 1. Setup

```bash
npm install
cp .env.example .env.local   # fill in every value
```

## 2. Database

In your Supabase project's SQL editor, run `supabase/schema.sql`.
Also create a public Storage bucket named `post-media` (Storage → New bucket).

## 3. Stripe

Create 3 recurring Prices in the Stripe dashboard ($29/$49/$99 monthly) and put
their price IDs into `.env.local`. Point a webhook at `/api/webhooks/stripe`
listening for `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`.

## 4. Platform developer apps

Register an app with each platform you want to support and fill in the
client id/secret pairs in `.env.local`:
- X: developer.twitter.com
- Instagram/Facebook: developers.facebook.com (Meta App Review required for content publishing)
- TikTok: developers.tiktok.com
- LinkedIn: linkedin.com/developers
- YouTube: console.cloud.google.com (enable YouTube Data API v3)

## 5. Cron (scheduled posts)

Deploy to Vercel and add a `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
```
Set `CRON_SECRET` in env vars — Vercel sends it as a bearer token automatically
for crons defined this way once configured in the dashboard.

## 6. Run locally

```bash
npm run dev
```

## Structure

- `app/` — pages + API routes (App Router)
- `lib/adapters/` — one file per social platform's publish logic
- `lib/platforms.ts` — OAuth config + plan limits
- `supabase/schema.sql` — full DB schema + RLS policies

## Known simplifications to harden before production

- Media upload to X/YouTube adapters use simplified URL-based flows — swap in
  real resumable/multipart uploads per platform docs.
- Access tokens are stored in plaintext in `social_accounts.access_token` —
  encrypt with Supabase Vault or similar before production use.
- Token refresh (for expired `access_token`s) isn't implemented yet — add a
  `refreshToken()` method per adapter and call it before publish if expired.
