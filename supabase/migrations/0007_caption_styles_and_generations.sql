-- AI caption generation: per-user, per-platform style profiles, and a log of
-- what was generated.
--
-- WHY THE STYLE LIVES IN THE DATABASE
-- The whole point is that a user tunes how each platform sounds without anyone
-- touching the repo. Prompts in source would mean a deploy per adjustment, and
-- would make the style global when every user needs their own voice.
--
-- WHY EXAMPLES RATHER THAN A TONE SETTING
-- "Write like a top performer" produces the average of the internet. Real
-- posts the user chose are the only thing that reliably carries a voice, so
-- examples are the primary input and the instructions are the steer on top.

create table if not exists platform_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null check (platform in ('x','instagram','tiktok','youtube','linkedin','facebook')),

  -- Free-text steer: audience, angle, things to never say. The user's words,
  -- passed to the model close to verbatim.
  instructions text not null default '',

  -- Posts the user is proud of, used as few-shot examples. Ordered as given.
  examples text[] not null default '{}',

  -- OpenRouter model slug for this platform, e.g. 'anthropic/claude-sonnet-4'.
  -- Per platform so a long-form LinkedIn post and a 280-character tweet can
  -- use different models, and so a model can be swapped without a deploy.
  model text not null default '',

  -- Off means "do not generate for this platform", distinct from an empty
  -- style, which means "generate with defaults".
  enabled boolean not null default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One style per platform per user; the dashboard upserts on this.
  unique (user_id, platform)
);

-- Every generation, one row. This is the meter: the plan cap is enforced by
-- counting this month's rows, so there is no counter to drift out of step with
-- reality, and a user can be shown exactly what they spent.
create table if not exists caption_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null,
  model text not null,
  -- Null when OpenRouter did not report usage; never guessed at.
  prompt_tokens integer,
  completion_tokens integer,
  -- False rows still count against the cap: a failed call costs money too.
  succeeded boolean not null default true,
  error_message text,
  created_at timestamptz default now()
);

alter table platform_styles enable row level security;
alter table caption_generations enable row level security;

create policy "own platform styles" on platform_styles for all using (auth.uid() = user_id);
create policy "own caption generations" on caption_generations for all using (auth.uid() = user_id);

-- The cap query is "count this user's rows since the start of the month".
create index if not exists caption_generations_user_month_idx
  on caption_generations (user_id, created_at desc);

create index if not exists platform_styles_user_idx on platform_styles (user_id);

comment on table platform_styles is
  'Per-user, per-platform caption style: instructions, few-shot examples and the OpenRouter model. Edited from the styles dashboard, never from source.';

comment on table caption_generations is
  'One row per caption generation attempt, successful or not. Counting rows for the current month is how the per-plan cap is enforced.';
