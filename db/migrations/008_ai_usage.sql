create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null,
  env text not null,
  provider text not null,
  model text not null,
  calls int not null default 0,
  calls_without_usage int not null default 0,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  web_searches int not null default 0,
  outcome text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists ai_usage_created on ai_usage (created_at desc);
alter table ai_usage enable row level security;

create table if not exists ai_prices (
  provider text not null,
  model text not null,
  input_per_m numeric not null,
  cached_input_per_m numeric not null,
  cache_write_per_m numeric not null default 0,
  output_per_m numeric not null,
  per_web_search numeric not null default 0,
  note text,
  primary key (provider, model)
);
alter table ai_prices enable row level security;

insert into ai_prices (provider, model, input_per_m, cached_input_per_m, cache_write_per_m, output_per_m, per_web_search, note) values
  ('openai', 'gpt-6-luna', 0.10, 0.01, 0.125, 0.50, 0.01,
   'Standard API rates, developers.openai.com/api/docs/pricing (checked 2026-11-14). Web search $10 per 1,000 calls; the pages it reads count as input tokens.'),
  ('groq', 'openai/gpt-oss-120b', 0, 0, 0, 0, 0,
   'Free plan, so 0. On a paid plan: $0.15 input, $0.075 cached, $0.60 output per million (console.groq.com, checked 2026-11-14).')
on conflict (provider, model) do nothing;

create or replace view ai_usage_costed with (security_invoker = true) as
select
  u.*,
  round((
    (u.input_tokens - u.cached_input_tokens - u.cache_write_tokens) * p.input_per_m
    + u.cached_input_tokens * p.cached_input_per_m
    + u.cache_write_tokens * p.cache_write_per_m
    + u.output_tokens * p.output_per_m
  ) / 1e6 + u.web_searches * p.per_web_search, 6) as cost_usd
from ai_usage u
left join ai_prices p on p.provider = u.provider and p.model = u.model;

create or replace view ai_cost_daily with (security_invoker = true) as
select
  (created_at at time zone 'Asia/Kolkata')::date as day,
  source,
  env,
  count(*) as requests,
  count(*) filter (where outcome = 'cached') as cached_answers,
  sum(calls) as ai_calls,
  sum(calls_without_usage) as calls_without_usage,
  round(avg(input_tokens + output_tokens)) as avg_tokens,
  round(avg(input_tokens)) as avg_input_tokens,
  round(avg(output_tokens)) as avg_output_tokens,
  sum(web_searches) as web_searches,
  sum(cost_usd) as cost_usd,
  round(avg(cost_usd), 6) as avg_cost_usd
from ai_usage_costed
group by 1, 2, 3;
