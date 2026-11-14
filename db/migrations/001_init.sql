create table if not exists editions (
  date          date primary key,
  generated_at  timestamptz not null default now(),
  ai            text,
  story_count   integer not null default 0,
  stats         jsonb not null default '{}'::jsonb
);

create table if not exists stories (
  id              bigint generated always as identity primary key,
  edition_date    date not null references editions(date) on delete cascade,
  position        integer not null,
  headline        text not null,
  summary         text not null default '',
  why_it_matters  text not null default '',
  topic           text not null,
  score           real not null default 0,
  importance      smallint,
  published       timestamptz not null,
  sources         jsonb not null default '[]'::jsonb,
  unique (edition_date, position)
);

create index if not exists stories_topic_idx on stories (topic, edition_date desc);

create table if not exists summary_cache (
  key         text primary key,
  body        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table editions enable row level security;
alter table stories enable row level security;
alter table summary_cache enable row level security;

drop policy if exists "public read editions" on editions;
create policy "public read editions" on editions for select using (true);

drop policy if exists "public read stories" on stories;
create policy "public read stories" on stories for select using (true);
