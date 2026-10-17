-- Team members and an activity log, for team mode.
--
-- WHY A TEAM TABLE WITHOUT AUTH USERS
-- Team mode (TEAM_MODE=1, see lib/team/mode.ts) runs the whole app as one
-- shared workspace account so a team can use it before login exists. Members
-- are rows here, not auth.users: you pick your name, no password. When real
-- login lands, each member gains an auth identity and this table is where it
-- attaches — nothing here has to be thrown away.
--
-- Every row belongs to the workspace (the shared auth user), so the existing
-- "auth.uid() owns it" RLS pattern scopes it exactly like posts and accounts.
--
-- WHY member_name IS COPIED INTO THE LOG
-- Removing someone must not turn their history into "unknown did something".

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

create unique index if not exists team_members_email_unique
  on team_members (workspace_id, lower(email)) where email is not null;
create index if not exists team_members_workspace on team_members (workspace_id);

create table if not exists team_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  member_id uuid references team_members(id) on delete set null,
  member_name text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_recent on team_activity (workspace_id, created_at desc);

-- Who made it. Nullable: everything created before team mode has no author,
-- and removing a member keeps their posts.
alter table posts add column if not exists created_by uuid references team_members(id) on delete set null;
alter table caption_generations add column if not exists created_by uuid references team_members(id) on delete set null;

alter table team_members enable row level security;
alter table team_activity enable row level security;

drop policy if exists "own team members" on team_members;
create policy "own team members" on team_members for all
  using (auth.uid() = workspace_id) with check (auth.uid() = workspace_id);

drop policy if exists "own team activity" on team_activity;
create policy "own team activity" on team_activity for all
  using (auth.uid() = workspace_id) with check (auth.uid() = workspace_id);
