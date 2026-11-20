create table if not exists feedback (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  kind           text not null check (kind in ('brief_rating', 'story_report')),
  edition_date   date,
  rating         text check (rating in ('good', 'ok', 'bad')),
  story_key      text check (story_key ~ '^[a-z0-9-]{6,40}$'),
  subscriber_id  uuid references subscribers(id) on delete set null,
  message        text check (char_length(message) between 1 and 1000),
  check (
    (kind = 'brief_rating' and edition_date is not null and rating is not null and story_key is null)
    or (kind = 'story_report' and story_key is not null and message is not null
        and rating is null and subscriber_id is null)
  )
);

create unique index if not exists feedback_one_rating on feedback (edition_date, subscriber_id);
create index if not exists feedback_created on feedback (created_at desc);

alter table feedback enable row level security;
