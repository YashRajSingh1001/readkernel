alter table stories add column if not exists story_key text;
alter table stories add column if not exists brief_position integer;

update stories set brief_position = position where brief_position is null and story_key is null;
update stories set story_key = substr(md5(edition_date::text || ':' || position::text), 1, 12)
  where story_key is null;

create index if not exists stories_key_idx on stories (story_key, edition_date desc);
create index if not exists stories_brief_idx on stories (edition_date, brief_position)
  where brief_position is not null;
