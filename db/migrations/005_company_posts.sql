-- Company blogs: engineering and data science posts from companies like
-- Netflix and Uber. Each post is saved once, the first day the pipeline sees
-- it (its address is the primary key, so a post is never added twice).
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists company_posts (
  url         text primary key,      -- cleaned-up address, used to skip posts we already have
  link        text not null,         -- the address readers open
  title       text not null,
  company     text not null,
  published   timestamptz not null,
  summary     text not null default '',
  category    text not null default 'engineering'
              check (category in ('ai', 'ml', 'data', 'infra', 'apps', 'security', 'engineering')),
  depth       smallint check (depth between 1 and 5),   -- AI's rating: 1 = announcement, 5 = deep write-up
  score       real not null default 0,                  -- for ranking: depth, company trust, Hacker News points
  image_url   text,
  hn_points   integer,
  found_via   text not null default 'feed' check (found_via in ('feed', 'hn')),
  added_at    timestamptz not null default now(),
  search      tsvector generated always as (
                to_tsvector('english', title || ' ' || summary || ' ' || company)
              ) stored
);

create index if not exists company_posts_published on company_posts (published desc);
create index if not exists company_posts_added on company_posts (added_at desc);
create index if not exists company_posts_category on company_posts (category, published desc);
create index if not exists company_posts_search on company_posts using gin (search);

alter table company_posts enable row level security;
drop policy if exists "public read company posts" on company_posts;
create policy "public read company posts" on company_posts for select using (true);

-- Readers choose whether the email ends with one "company read".
alter table subscribers add column if not exists company_read boolean not null default true;
