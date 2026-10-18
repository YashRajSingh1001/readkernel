-- ReadKernel: everything phases 1-5 need, in one file. Run once in the
-- Supabase SQL editor after 003_feed.sql. Safe to run twice.

-- ---------------------------------------------------------------------------
-- Stories: photo, kind, and the thread that links one story across days
-- ---------------------------------------------------------------------------
alter table stories add column if not exists image_url text;      -- publisher's own preview photo
alter table stories add column if not exists image_credit text;   -- e.g. "The Verge"
alter table stories add column if not exists kind text not null default 'news'
  check (kind in ('news', 'model_release'));
alter table stories add column if not exists thread_id text;      -- same id = same ongoing story

create index if not exists stories_thread_idx on stories (thread_id, edition_date desc);
-- Stories saved before threads existed start their own thread.
update stories set thread_id = story_key where thread_id is null;

-- Archive search (headline + summary), used by /search.
alter table stories add column if not exists search tsvector
  generated always as (to_tsvector('english', coalesce(headline, '') || ' ' || coalesce(summary, ''))) stored;
create index if not exists stories_search_idx on stories using gin (search);

-- ---------------------------------------------------------------------------
-- Top articles: the day's most-discussed developer posts (Hacker News etc.)
-- ---------------------------------------------------------------------------
create table if not exists discussions (
  edition_date  date not null references editions(date) on delete cascade,
  position      integer not null,
  title         text not null,
  url           text not null,
  comments_url  text,
  source        text not null,
  points        integer,
  comments      integer,
  summary       text not null default '',
  primary key (edition_date, position)
);
alter table discussions enable row level security;
drop policy if exists "public read discussions" on discussions;
create policy "public read discussions" on discussions for select using (true);

-- ---------------------------------------------------------------------------
-- Subscribers: "make it yours" preferences + optional link to a signed-in user
-- ---------------------------------------------------------------------------
alter table subscribers add column if not exists topics text[] not null default '{}';  -- empty = all topics
alter table subscribers add column if not exists story_count integer not null default 10
  check (story_count in (5, 10, 15));
alter table subscribers add column if not exists format text not null default 'summaries'
  check (format in ('summaries', 'headlines', 'images'));
alter table subscribers add column if not exists frequency text not null default 'daily'
  check (frequency in ('daily', 'weekly'));
alter table subscribers add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Daily and weekly emails are logged separately.
alter table email_sends add column if not exists kind text not null default 'daily'
  check (kind in ('daily', 'weekly'));
alter table email_sends drop constraint if exists email_sends_pkey;
alter table email_sends add primary key (edition_date, subscriber_id, kind);

-- ---------------------------------------------------------------------------
-- Saved stories for signed-in readers (signed-out readers save in the browser)
-- ---------------------------------------------------------------------------
create table if not exists saved_stories (
  user_id    uuid not null references auth.users(id) on delete cascade,
  story_key  text not null,
  headline   text not null,
  topic      text not null,
  url        text not null,
  source     text not null,
  saved_at   timestamptz not null default now(),
  primary key (user_id, story_key)
);
alter table saved_stories enable row level security;
drop policy if exists "own saved stories" on saved_stories;
create policy "own saved stories" on saved_stories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
