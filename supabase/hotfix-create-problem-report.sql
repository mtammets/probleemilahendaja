create or replace function public.create_problem_report(
    p_session_id uuid,
    p_problem_text text,
    p_problem_type text,
    p_status text,
    p_clarity_level text,
    p_summary text,
    p_analysis text,
    p_resolution text
)
returns table (
    report_id uuid,
    solved_reports_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_report_id uuid;
    v_solved_reports_total bigint;
begin
    if p_session_id is null then
        raise exception 'session_id is required';
    end if;

    if char_length(trim(coalesce(p_problem_text, ''))) = 0 then
        raise exception 'problem_text is required';
    end if;

    insert into public.app_metrics (id, solved_reports_total)
    values (true, public.calculate_seed_solved_reports_total())
    on conflict (id) do nothing;

    insert into public.reports (
        session_id,
        problem_text,
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
        trim(coalesce(p_problem_type, 'Üldine olukord')),
        trim(coalesce(p_status, 'Lahendatud')),
        trim(coalesce(p_clarity_level, 'Hea')),
        trim(coalesce(p_summary, '')),
        trim(coalesce(p_analysis, '')),
        trim(coalesce(p_resolution, ''))
    )
    returning id into v_report_id;

    update public.app_metrics as metrics
    set
        solved_reports_total = metrics.solved_reports_total + 1,
        updated_at = timezone('utc', now())
    where metrics.id = true
    returning metrics.solved_reports_total into v_solved_reports_total;

    return query
    select v_report_id, v_solved_reports_total;
end;
$$;
