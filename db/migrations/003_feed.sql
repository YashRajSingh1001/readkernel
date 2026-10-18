-- ReadKernel: each day now stores a bigger feed (~30 stories); the 10 brief
-- stories are marked inside it. Run once in the Supabase SQL editor, after 002.

-- Stable id for a story's page (/story/<key>), from its lead article's link.
alter table stories add column if not exists story_key text;
-- 1-10 for stories in the daily brief, null for feed-only stories.
alter table stories add column if not exists brief_position integer;

-- Rows saved before this change were all brief stories.
update stories set brief_position = position where brief_position is null and story_key is null;
update stories set story_key = substr(md5(edition_date::text || ':' || position::text), 1, 12)
  where story_key is null;

create index if not exists stories_key_idx on stories (story_key, edition_date desc);
create index if not exists stories_brief_idx on stories (edition_date, brief_position)
  where brief_position is not null;
