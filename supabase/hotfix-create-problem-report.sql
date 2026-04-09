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

alter table public.reports
add column if not exists public_problem_text text;

update public.reports
set public_problem_text = left(regexp_replace(problem_text, '\s+', ' ', 'g'), 180)
where public_problem_text is null;

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

    insert into public.reports (
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
        id,
        public_problem_text,
        problem_type,
        status,
        created_at
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

grant usage on schema public to anon, authenticated;
grant execute on function public.get_public_metrics() to anon, authenticated;
grant execute on function public.create_problem_report(uuid, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_recent_problem_reports(integer) to anon, authenticated;
