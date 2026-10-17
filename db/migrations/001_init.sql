-- ReadKernel: daily editions, their stories, and the AI summary cache.
-- Run once in the Supabase SQL editor (or `psql -f`).

-- One row per day's brief.
create table if not exists editions (
  date          date primary key,
  generated_at  timestamptz not null default now(),
  ai            text,                       -- e.g. "groq:llama-3.3-70b-versatile", null = no AI
  story_count   integer not null default 0,
  stats         jsonb not null default '{}'::jsonb
);

-- The stories in each edition, in brief order.
create table if not exists stories (
  id              bigint generated always as identity primary key,
  edition_date    date not null references editions(date) on delete cascade,
  position        integer not null,          -- 1 = top story
  headline        text not null,
  summary         text not null default '',
  why_it_matters  text not null default '',
  topic           text not null,
  score           real not null default 0,
  importance      smallint,                  -- 1-5 from the AI editor, null if it didn't run
  published       timestamptz not null,      -- newest article in the story
  sources         jsonb not null default '[]'::jsonb,  -- [{name, title, url, published}]
  unique (edition_date, position)
);

create index if not exists stories_topic_idx on stories (topic, edition_date desc);

-- AI summaries, keyed by the story's article URLs + model, so each story is
-- summarised once even across runs.
create table if not exists summary_cache (
  key         text primary key,
  body        jsonb not null,
  created_at  timestamptz not null default now()
);

-- Row Level Security: anyone may read the news; only the pipeline (secret /
-- service-role key, which bypasses RLS) may write. The cache is private.
alter table editions enable row level security;
alter table stories enable row level security;
alter table summary_cache enable row level security;

drop policy if exists "public read editions" on editions;
create policy "public read editions" on editions for select using (true);

drop policy if exists "public read stories" on stories;
create policy "public read stories" on stories for select using (true);
