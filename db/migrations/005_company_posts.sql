create table if not exists company_posts (
  url         text primary key,
  link        text not null,
  title       text not null,
  company     text not null,
  published   timestamptz not null,
  summary     text not null default '',
  category    text not null default 'engineering'
              check (category in ('ai', 'ml', 'data', 'infra', 'apps', 'security', 'engineering')),
  depth       smallint check (depth between 1 and 5),
  score       real not null default 0,
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

alter table subscribers add column if not exists company_read boolean not null default true;
