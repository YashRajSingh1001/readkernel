create table if not exists story_companies (
  edition_date  date not null references editions(date) on delete cascade,
  story_key     text not null,
  company       text not null,
  name          text not null,
  primary key (edition_date, story_key, company)
);
create index if not exists story_companies_company on story_companies (company, edition_date desc);

alter table story_companies enable row level security;
drop policy if exists "public read story_companies" on story_companies;
create policy "public read story_companies" on story_companies for select using (true);

create table if not exists ask_answers (
  key         text primary key,
  answer      text not null,
  steps       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ask_answers_created on ask_answers (created_at);

alter table ask_answers enable row level security;
