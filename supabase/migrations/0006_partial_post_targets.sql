-- A target can now be partially published.
--
-- X's first comment and thread entries are separate tweets posted *after* the
-- main one is already live. If a reply fails there is no undo: the tweet is
-- public. 'posted' and 'failed' could not express that — storing 'failed'
-- would hide a live post and invite a retry that double-posts, while storing
-- 'posted' would drop the reply error on the floor.
--
-- 'partial' means: the main post is live, platform_post_id is real, and
-- error_message says what underneath it did not go out. Post-level status
-- counts it as published, because it is.

alter table post_targets
  drop constraint if exists post_targets_status_check;

alter table post_targets
  add constraint post_targets_status_check
  check (status in ('pending','posted','partial','failed'));

comment on column post_targets.status is
  'pending | posted | partial | failed. partial = the post itself is live but a reply under it (X first comment or thread entry) failed; platform_post_id is still valid and error_message holds the reply failure.';
