create table if not exists watches (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references subscribers(id) on delete cascade,
  description    text not null check (char_length(description) between 3 and 160),
  created_at     timestamptz not null default now()
);
create index if not exists watches_subscriber on watches (subscriber_id);

create table if not exists watch_hits (
  watch_id      uuid not null references watches(id) on delete cascade,
  item_key      text not null,
  edition_date  date not null,
  title         text not null,
  summary       text not null default '',
  url           text not null,
  reason        text not null default '',
  found_at      timestamptz not null default now(),
  primary key (watch_id, item_key)
);
create index if not exists watch_hits_date on watch_hits (edition_date);

alter table watches enable row level security;
alter table watch_hits enable row level security;
