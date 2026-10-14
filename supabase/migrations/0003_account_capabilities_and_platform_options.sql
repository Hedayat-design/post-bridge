-- Per-account capabilities and per-platform post options.
--
-- 1. has_x_premium: X Premium raises the caption limit from 280 to 25,000
--    characters. It is a property of the account, not of the platform, so the
--    limit cannot be a constant — see lib/adapters/limits.ts.
--
-- 2. platform_options: carries the disclosures TikTok and YouTube require for
--    AI-generated and sponsored content. Posting undeclared synthetic or paid
--    content breaches both platforms' terms, so a post has to be able to hold
--    the declaration.

alter table social_accounts
  add column if not exists has_x_premium boolean not null default false;

alter table posts
  add column if not exists platform_options jsonb not null default '{}'::jsonb;

comment on column social_accounts.has_x_premium is
  'X only: account is on X Premium, so it may post up to 25,000 characters.';

comment on column posts.platform_options is
  'Per-platform settings and required disclosures, keyed by platform. See PlatformOptions in lib/adapters/limits.ts.';
