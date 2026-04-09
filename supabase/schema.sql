create extension if not exists pgcrypto;

create or replace function public.calculate_seed_solved_reports_total()
returns bigint
language sql
as $$
    with elapsed as (
        select greatest(
            0,
            floor(
                extract(
                    epoch from (
                        timezone('utc', now()) - timestamptz '2026-01-01 09:00:00+00'
                    )
                )
            )::bigint
        ) as seconds
    )
    select
        1284320
        + seconds
        + floor(seconds / 6.0)::bigint
        + (floor(seconds / 17.0)::bigint * 2)
        + (floor(seconds / 43.0)::bigint * 5)
        + (floor(seconds / 173.0)::bigint * 9)
    from elapsed;
$$;

create table if not exists public.app_metrics (
    id boolean primary key default true check (id),
    solved_reports_total bigint not null default public.calculate_seed_solved_reports_total(),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_metrics (id, solved_reports_total)
values (true, public.calculate_seed_solved_reports_total())
on conflict (id) do nothing;

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    problem_text text not null check (char_length(problem_text) <= 4000),
    problem_type text not null,
    status text not null,
    clarity_level text not null,
    summary text not null,
    analysis text not null,
    resolution text not null,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.reports
add column if not exists public_problem_text text;

update public.reports
set public_problem_text = left(regexp_replace(problem_text, '\s+', ' ', 'g'), 180)
where public_problem_text is null;

create table if not exists public.report_ratings (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    session_id uuid not null,
    rating smallint not null check (rating between 1 and 5),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (report_id, session_id)
);

alter table public.app_metrics enable row level security;
alter table public.reports enable row level security;
alter table public.report_ratings enable row level security;

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        begin
            alter publication supabase_realtime add table public.reports;
        exception
            when duplicate_object then null;
        end;
    end if;
end;
$$;

create or replace function public.get_public_metrics()
returns table (solved_reports_total bigint)
language sql
security definer
set search_path = public
as $$
    select count(*)::bigint as solved_reports_total
    from public.reports;
$$;

drop function if exists public.create_problem_report(uuid, text, text, text, text, text, text, text, text);
drop function if exists public.create_problem_report(uuid, text, text, text, text, text, text, text);

create or replace function public.create_problem_report(
    p_session_id uuid,
    p_problem_text text,
    p_public_problem_text text,
    p_problem_type text,
    p_status text,
    p_clarity_level text,
    p_summary text,
    p_analysis text,
    p_resolution text
)
returns table (
    report_id uuid,
    solved_reports_total bigint,
    problem_text text,
    problem_type text,
    status text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_report_id uuid;
    v_solved_reports_total bigint;
    v_problem_text text;
    v_problem_type text;
    v_status text;
    v_created_at timestamptz;
begin
    if p_session_id is null then
        raise exception 'session_id is required';
    end if;

    if char_length(trim(coalesce(p_problem_text, ''))) = 0 then
        raise exception 'problem_text is required';
    end if;

    insert into public.reports as reports (
        session_id,
        problem_text,
        public_problem_text,
        problem_type,
        status,
        clarity_level,
        summary,
        analysis,
        resolution
    )
    values (
        p_session_id,
        trim(p_problem_text),
        left(trim(coalesce(p_public_problem_text, p_problem_text)), 180),
        trim(coalesce(p_problem_type, 'Üldine olukord')),
        trim(coalesce(p_status, 'Lahendatud')),
        trim(coalesce(p_clarity_level, 'Hea')),
        trim(coalesce(p_summary, '')),
        trim(coalesce(p_analysis, '')),
        trim(coalesce(p_resolution, ''))
    )
    returning
        reports.id,
        reports.public_problem_text,
        reports.problem_type,
        reports.status,
        reports.created_at
    into
        v_report_id,
        v_problem_text,
        v_problem_type,
        v_status,
        v_created_at;

    select count(*)::bigint
    into v_solved_reports_total
    from public.reports;

    return query
    select v_report_id, v_solved_reports_total, v_problem_text, v_problem_type, v_status, v_created_at;
end;
$$;

create or replace function public.get_recent_problem_reports(p_limit integer default 6)
returns table (
    report_id uuid,
    problem_text text,
    problem_type text,
    status text,
    created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select
        reports.id as report_id,
        coalesce(
            reports.public_problem_text,
            left(regexp_replace(reports.problem_text, '\s+', ' ', 'g'), 180)
        ) as problem_text,
        reports.problem_type,
        reports.status,
        reports.created_at
    from public.reports as reports
    order by reports.created_at desc
    limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

create or replace function public.submit_report_rating(
    p_report_id uuid,
    p_session_id uuid,
    p_rating smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_report_id is null then
        raise exception 'report_id is required';
    end if;

    if p_session_id is null then
        raise exception 'session_id is required';
    end if;

    if p_rating is null or p_rating < 1 or p_rating > 5 then
        raise exception 'rating must be between 1 and 5';
    end if;

    insert into public.report_ratings (
        report_id,
        session_id,
        rating
    )
    values (
        p_report_id,
        p_session_id,
        p_rating
    )
    on conflict (report_id, session_id)
    do update set
        rating = excluded.rating,
        updated_at = timezone('utc', now());
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.get_public_metrics() to anon, authenticated;
grant execute on function public.create_problem_report(uuid, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_recent_problem_reports(integer) to anon, authenticated;
grant execute on function public.submit_report_rating(uuid, uuid, smallint) to anon, authenticated;
