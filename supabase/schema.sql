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
  status text not null default 'pending' check (status in ('pending','posted','failed')),
  error_message text,
  posted_at timestamptz
);

-- ============ ROW LEVEL SECURITY ============
alter table profiles enable row level security;
alter table social_accounts enable row level security;
alter table posts enable row level security;
alter table post_targets enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own social accounts" on social_accounts for all using (auth.uid() = user_id);
create policy "own posts" on posts for all using (auth.uid() = user_id);
create policy "own post targets" on post_targets for all using (
  auth.uid() = (select user_id from posts where posts.id = post_targets.post_id)
);

-- ============ PLAN LIMITS (referenced in app logic) ============
-- free: 5 posts total, 1 connected account
-- starter ($29/mo): unlimited posts, 5 connected accounts
-- creator ($49/mo): unlimited posts, 15 connected accounts
-- pro ($99/mo): unlimited posts, unlimited connected accounts
