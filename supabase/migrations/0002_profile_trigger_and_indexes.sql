-- Run this after schema.sql, in the Supabase SQL editor.

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
-- The signup page inserted the profiles row from the browser. When email
-- confirmation is enabled there is no session at that moment, so RLS blocked
-- the insert and the user ended up with no profile row at all. Every later
-- plan lookup then returned null, and connecting a social account failed
-- outright because social_accounts.user_id references profiles(id).
--
-- Creating the row in a SECURITY DEFINER trigger makes it unconditional.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- PostgREST exposes every public function as an RPC endpoint, so a
-- SECURITY DEFINER function would otherwise be callable at
-- /rest/v1/rpc/handle_new_user by anonymous users. It only ever runs as a
-- trigger, so nothing should be able to call it directly.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this trigger existed.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ============ INDEXES ============
-- The cron scans for due posts every minute; without this it is a seq scan
-- over every post in the table.
create index if not exists posts_due_idx
  on posts (status, scheduled_for)
  where status = 'scheduled';

create index if not exists post_targets_post_idx on post_targets (post_id);
create index if not exists social_accounts_user_idx on social_accounts (user_id);
create index if not exists posts_user_created_idx on posts (user_id, created_at desc);

-- ============ MEDIA TYPE ============
-- Text-only posts are valid on X and LinkedIn, but the original check
-- constraint only allowed image/video/carousel.
alter table posts drop constraint if exists posts_media_type_check;
alter table posts add constraint posts_media_type_check
  check (media_type in ('image', 'video', 'carousel', 'text'));
