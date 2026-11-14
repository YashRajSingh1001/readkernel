begin;

create or replace function public.replace_edition(
  p_edition jsonb,
  p_stories jsonb,
  p_discussions jsonb,
  p_companies jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  edition_day date := (p_edition->>'date')::date;
begin
  insert into public.editions (date, generated_at, ai, story_count, stats)
  select date, generated_at, ai, story_count, stats
  from jsonb_populate_record(null::public.editions, p_edition)
  on conflict (date) do update set
    generated_at = excluded.generated_at,
    ai = excluded.ai,
    story_count = excluded.story_count,
    stats = excluded.stats;

  delete from public.stories where edition_date = edition_day;
  insert into public.stories (
    edition_date, position, brief_position, story_key, headline, summary,
    why_it_matters, topic, score, importance, published, sources,
    image_url, image_credit, kind, thread_id
  )
  select edition_day, position, brief_position, story_key, headline, summary,
    why_it_matters, topic, score, importance, published, sources,
    image_url, image_credit, kind, thread_id
  from jsonb_populate_recordset(null::public.stories, p_stories);

  if p_discussions is not null and p_discussions <> 'null'::jsonb then
    delete from public.discussions where edition_date = edition_day;
    insert into public.discussions (
      edition_date, position, title, url, comments_url, source, points, comments, summary
    )
    select edition_day, position, title, url, comments_url, source, points, comments, summary
    from jsonb_populate_recordset(null::public.discussions, p_discussions);
  end if;

  delete from public.story_companies where edition_date = edition_day;
  insert into public.story_companies (edition_date, story_key, company, name)
  select edition_day, story_key, company, name
  from jsonb_populate_recordset(null::public.story_companies, p_companies);
end;
$$;

revoke all on function public.replace_edition(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_edition(jsonb, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
