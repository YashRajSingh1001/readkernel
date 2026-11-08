-- Company tags and the Ask answer cache.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- Both are new tables (not new columns on stories), so the site and the
-- daily job keep working before this has run: only the company pages and
-- the Ask cache wait for it.

-- Which companies each story is about, from the daily summary (no extra AI
-- call). One row per story per company per day. Powers /company/<slug>,
-- the chips on story pages and the get_company_news tool.
create table if not exists story_companies (
  edition_date  date not null references editions(date) on delete cascade,
  story_key     text not null,
  company       text not null,   -- slug, e.g. "openai"
  name          text not null,   -- as written in the news, e.g. "OpenAI"
  primary key (edition_date, story_key, company)
);
create index if not exists story_companies_company on story_companies (company, edition_date desc);

alter table story_companies enable row level security;
drop policy if exists "public read story_companies" on story_companies;
create policy "public read story_companies" on story_companies for select using (true);

-- Answers to Ask's suggested questions on story pages ("Who are the
-- competitors here?"), shared by every reader of that story that day, so
-- each costs one AI answer instead of one per reader. The key includes the
-- edition date; the daily job deletes rows older than a few days.
create table if not exists ask_answers (
  key         text primary key,
  answer      text not null,
  steps       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ask_answers_created on ask_answers (created_at);

-- Private: only the website's server and the pipeline (secret key) use it.
alter table ask_answers enable row level security;
