-- Watch alerts: readers describe, in plain English, what they want to hear
-- about ("UPI rules", "Indian AI startups raising money"). Each morning an
-- agent checks the day's stories against every wish, and matches appear at
-- the top of that reader's email.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists watches (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references subscribers(id) on delete cascade,
  description    text not null check (char_length(description) between 3 and 160),
  created_at     timestamptz not null default now()
);
create index if not exists watches_subscriber on watches (subscriber_id);

-- One row per story a watch matched. The key stops the same story being
-- alerted twice for the same wish, even if it stays in the news for days.
create table if not exists watch_hits (
  watch_id      uuid not null references watches(id) on delete cascade,
  item_key      text not null,          -- story_key, or a company post's address
  edition_date  date not null,
  title         text not null,
  summary       text not null default '',
  url           text not null,
  reason        text not null default '', -- the agent's one-line "why this matches"
  found_at      timestamptz not null default now(),
  primary key (watch_id, item_key)
);
create index if not exists watch_hits_date on watch_hits (edition_date);

-- Private: only the pipeline and the website's server (secret key) can read these.
alter table watches enable row level security;
alter table watch_hits enable row level security;
