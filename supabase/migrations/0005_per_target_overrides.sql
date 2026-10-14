-- Per-platform and per-account caption/media overrides.
--
-- One caption for every platform is wrong for the product: 280 characters on X
-- and 3,000 on LinkedIn want different text, and a user with two X accounts may
-- want different text on each. A post therefore carries overrides that are
-- resolved per target at publish time, account override → platform override →
-- the post's own caption/media_urls.
--
-- WHY NOT posts.platform_options
-- Upstream merges the two: their TwitterConfiguration carries `caption` and
-- `media` alongside `first_comment`, and their TiktokConfiguration carries them
-- alongside `is_aigc`. We keep them apart because the two have opposite
-- lifetimes in our code: platform_options is passed *through* the adapter to
-- the platform API (it is PublishInput.platformOptions), whereas an override is
-- resolved *away* before the adapter is called — the adapter only ever sees the
-- resolved caption. Merging them would hand every adapter two sources of truth
-- for the caption, which is the subtle bug this feature is most likely to grow.
-- account_configurations settles it anyway: it is keyed by account id, so it
-- could never live in a platform-keyed column, and splitting the pair across
-- two places would be worse than keeping them together here.
--
-- SHAPES (see lib/adapters/overrides.ts, which is the authority)
--   platform_configurations: { "<platform>":   { caption?: string, media?: string[] } }
--   account_configurations:  { "<account_id>": { caption?: string, media?: string[] } }
--
-- `media` holds media URLs, not ids: our posts store media_urls directly (see
-- gap #5 in docs/upstream-reference.md). account_configurations is an object
-- keyed by our uuid, where upstream sends an array of {account_id, ...}; an
-- object cannot carry the same account twice with conflicting overrides.
--
-- A missing key means "fall through to the next level". An explicitly empty
-- caption ("") or empty media ([]) is a real override, so a user can send text
-- to X and media-only to Instagram from one post.

alter table posts
  add column if not exists platform_configurations jsonb not null default '{}'::jsonb,
  add column if not exists account_configurations jsonb not null default '{}'::jsonb;

comment on column posts.platform_configurations is
  'Caption/media overrides keyed by platform, resolved at publish time. See lib/adapters/overrides.ts.';

comment on column posts.account_configurations is
  'Caption/media overrides keyed by social_accounts.id; takes precedence over platform_configurations. See lib/adapters/overrides.ts.';
