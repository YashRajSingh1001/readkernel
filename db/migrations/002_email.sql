create table if not exists subscribers (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email = lower(email)),
  status           text not null default 'pending'
                     check (status in ('pending', 'active', 'unsubscribed')),
  token            text not null unique,
  created_at       timestamptz not null default now(),
  confirm_sent_at  timestamptz,
  confirmed_at     timestamptz,
  unsubscribed_at  timestamptz
);

create index if not exists subscribers_status_idx on subscribers (status);

create table if not exists email_sends (
  edition_date   date not null references editions(date) on delete cascade,
  subscriber_id  uuid not null references subscribers(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  primary key (edition_date, subscriber_id)
);

alter table subscribers enable row level security;
alter table email_sends enable row level security;
