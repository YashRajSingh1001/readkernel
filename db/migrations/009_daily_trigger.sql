create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.trigger_daily_brief(send_email boolean default true)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';
  if token is null then
    raise exception 'Vault secret github_dispatch_token is missing';
  end if;
  return net.http_post(
    url := 'https://api.github.com/repos/YashRajSingh1001/readkernel/actions/workflows/daily-brief.yml/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('send_email', send_email::text)),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'readkernel-scheduler'
    )
  );
end;
$$;

revoke all on function private.trigger_daily_brief(boolean) from public, anon, authenticated;

select cron.unschedule('daily-brief') where exists (select 1 from cron.job where jobname = 'daily-brief');
select cron.schedule('daily-brief', '45 0 * * *', 'select private.trigger_daily_brief(true)');
