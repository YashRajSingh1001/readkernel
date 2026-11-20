create table if not exists explainers (
  slug         text primary key,
  week_of      date not null,
  story_key    text not null,
  title        text not null,
  body         jsonb not null,
  source_name  text not null,
  source_url   text not null,
  status       text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  check ((status = 'approved') = (approved_at is not null))
);

-- One live explainer a week. A rejected draft frees the week for another story.
create unique index if not exists explainers_one_per_week on explainers (week_of) where status <> 'rejected';
create index if not exists explainers_story on explainers (story_key);
create index if not exists explainers_approved on explainers (approved_at desc) where status = 'approved';

alter table explainers enable row level security;
drop policy if exists "public read approved explainers" on explainers;
create policy "public read approved explainers" on explainers for select using (status = 'approved');
