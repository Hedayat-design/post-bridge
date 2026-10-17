-- POST BRIDGE CLONE — DATABASE SCHEMA
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ============ PROFILES (extends Supabase auth.users) ============
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  plan text not null default 'free' check (plan in ('free','starter','creator','pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'inactive',
  created_at timestamptz default now()
);

-- ============ SOCIAL ACCOUNTS (connected platforms) ============
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null check (platform in ('x','instagram','tiktok','youtube','linkedin','facebook')),
  platform_account_id text not null,       -- id on the external platform
  display_name text,
  avatar_url text,
  access_token text not null,               -- encrypt at rest via Supabase Vault in production
  refresh_token text,
  token_expires_at timestamptz,
  -- X Premium allows 25,000-character posts instead of 280. A property of the
  -- account, so the caption limit cannot be a per-platform constant.
  has_x_premium boolean not null default false,
  connected_at timestamptz default now(),
  unique(user_id, platform, platform_account_id)
);

-- ============ POSTS (the content a user creates) ============
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  caption text,
  media_urls text[] default '{}',           -- Supabase Storage URLs
  media_type text check (media_type in ('image','video','carousel')),
  status text not null default 'draft' check (status in ('draft','scheduled','posting','posted','failed')),
  -- Per-platform settings and the disclosures TikTok/YouTube require for
  -- AI-generated and sponsored content. See PlatformOptions in lib/adapters/limits.ts.
  platform_options jsonb not null default '{}'::jsonb,
  -- Caption/media overrides, resolved per target as account → platform → post.
  -- Kept out of platform_options because those are passed through to the
  -- platform API while these are resolved away before the adapter is called.
  -- See lib/adapters/overrides.ts and migration 0005.
  --   platform_configurations: { "<platform>":   { caption?, media? } }
  --   account_configurations:  { "<account_id>": { caption?, media? } }
  platform_configurations jsonb not null default '{}'::jsonb,
  account_configurations jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,                -- null = post immediately
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '3 months') -- free 3-month storage
);

-- ============ POST TARGETS (which connected account each post goes to) ============
-- one row per platform a single post is sent to, so retries/failures are per-platform
create table if not exists post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  social_account_id uuid references social_accounts(id) on delete cascade not null,
  platform_post_id text,                    -- id returned by the platform once posted
  -- 'partial' = the post itself is live but a reply under it failed (X first
  -- comment / thread entry). There is no undo for a published tweet, so the
  -- id stays valid and error_message carries the reply failure.
  status text not null default 'pending' check (status in ('pending','posted','partial','failed')),
  error_message text,
  posted_at timestamptz
);

-- ============ CAPTION STYLES (AI generation) ============
-- Per-user, per-platform voice: the instructions and example posts the model
-- writes from. In the database rather than in source so a user can retune a
-- platform without a deploy, and so each user has their own voice.
-- See migration 0007 and lib/ai/.
create table if not exists platform_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null check (platform in ('x','instagram','tiktok','youtube','linkedin','facebook')),
  instructions text not null default '',
  examples text[] not null default '{}',          -- few-shot posts, in order
  model text not null default '',                  -- OpenRouter slug, per platform
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, platform)
);

-- One row per generation attempt. Counting this month's rows is the plan cap,
-- so there is no counter that can drift away from what was actually spent.
create table if not exists caption_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  succeeded boolean not null default true,
  error_message text,
  created_at timestamptz default now()
);

-- ============ TEAM (team mode) ============
-- Members of the shared workspace and what they did. See migration 0008 and
-- lib/team/ — members pick their name instead of signing in until real login
-- exists, so they are rows here rather than auth users.
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text check (email is null or char_length(email) <= 254),
  title text check (title is null or char_length(title) <= 80),
  role text not null default 'editor' check (role in ('owner','admin','editor','viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists team_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  member_id uuid references team_members(id) on delete set null,
  member_name text,                         -- survives the member being removed
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table posts add column if not exists created_by uuid references team_members(id) on delete set null;
alter table caption_generations add column if not exists created_by uuid references team_members(id) on delete set null;

-- ============ ROW LEVEL SECURITY ============
alter table profiles enable row level security;
alter table social_accounts enable row level security;
alter table posts enable row level security;
alter table post_targets enable row level security;
alter table platform_styles enable row level security;
alter table caption_generations enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own social accounts" on social_accounts for all using (auth.uid() = user_id);
create policy "own posts" on posts for all using (auth.uid() = user_id);
create policy "own post targets" on post_targets for all using (
  auth.uid() = (select user_id from posts where posts.id = post_targets.post_id)
);
create policy "own platform styles" on platform_styles for all using (auth.uid() = user_id);
create policy "own caption generations" on caption_generations for all using (auth.uid() = user_id);

alter table team_members enable row level security;
alter table team_activity enable row level security;
create policy "own team members" on team_members for all
  using (auth.uid() = workspace_id) with check (auth.uid() = workspace_id);
create policy "own team activity" on team_activity for all
  using (auth.uid() = workspace_id) with check (auth.uid() = workspace_id);

-- ============ PLAN LIMITS (referenced in app logic) ============
-- free: 5 posts total, 1 connected account
-- starter ($29/mo): unlimited posts, 5 connected accounts
-- creator ($49/mo): unlimited posts, 15 connected accounts
-- pro ($99/mo): unlimited posts, unlimited connected accounts
