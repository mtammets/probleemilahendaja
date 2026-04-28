create table if not exists public.past_life_readings (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null unique,
    result text not null check (
        result in ('man', 'woman')
    ),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists past_life_readings_result_created_idx
on public.past_life_readings (result, created_at desc);

drop trigger if exists set_past_life_readings_updated_at on public.past_life_readings;
create trigger set_past_life_readings_updated_at
before update on public.past_life_readings
for each row
execute function public.set_updated_at();

alter table public.past_life_readings enable row level security;

create or replace function public.get_past_life_reading_stats(
    p_session_id uuid default null
)
returns table (
    session_result text,
    total_responses bigint,
    man_count bigint,
    woman_count bigint,
    man_share numeric,
    woman_share numeric
)
language sql
security definer
set search_path = public
as $$
    with totals as (
        select
            count(*)::bigint as total_responses,
            count(*) filter (where past_life_readings.result = 'man')::bigint as man_count,
            count(*) filter (where past_life_readings.result = 'woman')::bigint as woman_count
        from public.past_life_readings
    ),
    current_session as (
        select past_life_readings.result as session_result
        from public.past_life_readings
        where past_life_readings.session_id = p_session_id
        limit 1
    )
    select
        current_session.session_result,
        totals.total_responses,
        totals.man_count,
        totals.woman_count,
        case
            when totals.total_responses = 0 then 0::numeric
            else round((totals.man_count::numeric * 100.0) / totals.total_responses, 1)
        end as man_share,
        case
            when totals.total_responses = 0 then 0::numeric
            else round((totals.woman_count::numeric * 100.0) / totals.total_responses, 1)
        end as woman_share
    from totals
    left join current_session on true;
$$;

create or replace function public.submit_past_life_reading(
    p_session_id uuid
)
returns table (
    session_result text,
    total_responses bigint,
    man_count bigint,
    woman_count bigint,
    man_share numeric,
    woman_share numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result text;
begin
    if p_session_id is null then
        raise exception 'session_id is required';
    end if;

    insert into public.past_life_readings (
        session_id,
        result
    )
    values (
        p_session_id,
        case
            when random() < 0.5 then 'man'
            else 'woman'
        end
    )
    on conflict (session_id)
    do nothing
    returning past_life_readings.result
    into v_result;

    if v_result is null then
        select past_life_readings.result
        into v_result
        from public.past_life_readings
        where past_life_readings.session_id = p_session_id
        limit 1;
    end if;

    return query
    select
        summary.session_result,
        summary.total_responses,
        summary.man_count,
        summary.woman_count,
        summary.man_share,
        summary.woman_share
    from public.get_past_life_reading_stats(p_session_id) as summary;
end;
$$;

grant execute on function public.get_past_life_reading_stats(uuid) to anon, authenticated;
grant execute on function public.submit_past_life_reading(uuid) to anon, authenticated;
