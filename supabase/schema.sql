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

create or replace function public.normalize_problem_category(
    p_problem_type text,
    p_problem_text text default ''
)
returns text
language sql
immutable
set search_path = public
as $$
    with source as (
        select lower(trim(concat_ws(' ', coalesce(p_problem_type, ''), coalesce(p_problem_text, '')))) as value
    )
    select
        case
            when value = '' then 'Segateemad'
            when value like any (array[
                '%töö%',
                '%projekt%',
                '%tähtaeg%',
                '%klient%',
                '%boss%',
                '%juht%',
                '%koosolek%',
                '%kolleeg%',
                '%karjäär%',
                '%vastutus%',
                '%tempo%'
            ]) then 'Töö ja vastutus'
            when value like any (array[
                '%raha%',
                '%palk%',
                '%eelarve%',
                '%võlg%',
                '%laen%',
                '%arve%',
                '%kulud%',
                '%sissetulek%',
                '%makse%',
                '%asjaajamine%'
            ]) then 'Raha ja kohustused'
            when value like any (array[
                '%suhe%',
                '%partner%',
                '%sõber%',
                '%pere%',
                '%ema%',
                '%isa%',
                '%abikaasa%',
                '%tüli%',
                '%konflikt%',
                '%suhtlus%',
                '%inimesed%'
            ]) then 'Suhted ja suhtlus'
            when value like any (array[
                '%kodu%',
                '%kodune%',
                '%korter%',
                '%maja%',
                '%remont%',
                '%naaber%',
                '%majapidamine%',
                '%olme%',
                '%igapäev%',
                '%segadus%'
            ]) then 'Kodu ja igapäev'
            when value like any (array[
                '%stress%',
                '%ärev%',
                '%väsim%',
                '%tervis%',
                '%uni%',
                '%läbipõlem%',
                '%kurnat%',
                '%pinge%',
                '%depress%',
                '%energia%'
            ]) then 'Tervis ja koormus'
            when value like any (array[
                '%otsus%',
                '%valik%',
                '%valima%',
                '%kolida%',
                '%lahkuda%',
                '%jääda%',
                '%suund%',
                '%variant%'
            ]) then 'Otsus ja suunavalik'
            else 'Segateemad'
        end
    from source;
$$;

update public.reports
set problem_type = public.normalize_problem_category(problem_type, problem_text)
where problem_type is distinct from public.normalize_problem_category(problem_type, problem_text);

create index if not exists reports_problem_type_created_idx
on public.reports (problem_type, created_at desc);

create table if not exists public.report_ratings (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    session_id uuid not null,
    rating smallint not null check (rating between 1 and 5),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (report_id, session_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.editorial_items (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    content_type text not null check (
        content_type in ('daily_article', 'daily_persona', 'daily_horoscope', 'daily_weather')
    ),
    date_key date not null,
    location_key text,
    generation_signature text,
    status text not null default 'published' check (
        status in ('draft', 'review', 'scheduled', 'published', 'archived')
    ),
    title text,
    summary text,
    payload jsonb not null default '{}'::jsonb,
    cover_media_path text,
    cover_media_url text,
    source_model text,
    prompt_version text,
    style_version integer not null default 1,
    published_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists editorial_items_content_type_date_idx
on public.editorial_items (content_type, date_key desc, published_at desc);

create index if not exists editorial_items_status_idx
on public.editorial_items (status, content_type, published_at desc);

create table if not exists public.media_assets (
    id uuid primary key default gen_random_uuid(),
    editorial_item_id uuid references public.editorial_items(id) on delete cascade,
    storage_bucket text not null,
    storage_path text not null unique,
    public_url text not null,
    mime_type text not null,
    alt_text text,
    origin text not null default 'openai' check (
        origin in ('openai', 'upload', 'fallback')
    ),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_generation_runs (
    id uuid primary key default gen_random_uuid(),
    content_type text not null,
    item_slug text,
    status text not null check (
        status in ('started', 'completed', 'failed')
    ),
    model text,
    prompt_version text,
    input_payload jsonb not null default '{}'::jsonb,
    output_payload jsonb not null default '{}'::jsonb,
    error_message text,
    created_at timestamptz not null default timezone('utc', now()),
    finished_at timestamptz
);

create index if not exists ai_generation_runs_content_type_created_idx
on public.ai_generation_runs (content_type, created_at desc);

create table if not exists public.newsletter_signups (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    email_normalized text not null unique,
    source text not null default 'homepage-form',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_reports_updated_at on public.report_ratings;
create trigger set_reports_updated_at
before update on public.report_ratings
for each row
execute function public.set_updated_at();

drop trigger if exists set_editorial_items_updated_at on public.editorial_items;
create trigger set_editorial_items_updated_at
before update on public.editorial_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_media_assets_updated_at on public.media_assets;
create trigger set_media_assets_updated_at
before update on public.media_assets
for each row
execute function public.set_updated_at();

drop trigger if exists set_newsletter_signups_updated_at on public.newsletter_signups;
create trigger set_newsletter_signups_updated_at
before update on public.newsletter_signups
for each row
execute function public.set_updated_at();

alter table public.app_metrics enable row level security;
alter table public.reports enable row level security;
alter table public.report_ratings enable row level security;
alter table public.editorial_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.ai_generation_runs enable row level security;
alter table public.newsletter_signups enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'editorial-media',
    'editorial-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read editorial media" on storage.objects;
create policy "Public can read editorial media"
on storage.objects
for select
to public
using (bucket_id = 'editorial-media');

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
        public.normalize_problem_category(p_problem_type, p_problem_text),
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

create or replace function public.get_problem_category_stats(p_days integer default 30)
returns table (
    problem_type text,
    problem_count bigint,
    share_percent numeric,
    total_reports bigint
)
language sql
security definer
set search_path = public
as $$
    with filtered_reports as (
        select public.normalize_problem_category(reports.problem_type, reports.problem_text) as problem_type
        from public.reports as reports
        where reports.created_at >= timezone('utc', now()) - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    ),
    category_counts as (
        select
            filtered_reports.problem_type,
            count(*)::bigint as problem_count
        from filtered_reports
        group by filtered_reports.problem_type
    ),
    totals as (
        select coalesce(sum(category_counts.problem_count), 0)::bigint as total_reports
        from category_counts
    )
    select
        category_counts.problem_type,
        category_counts.problem_count,
        case
            when totals.total_reports = 0 then 0::numeric
            else round((category_counts.problem_count::numeric * 100.0) / totals.total_reports, 1)
        end as share_percent,
        totals.total_reports
    from category_counts
    cross join totals
    order by category_counts.problem_count desc, category_counts.problem_type asc;
$$;

create or replace function public.get_problem_category_trends(p_days integer default 30)
returns table (
    problem_type text,
    current_count bigint,
    previous_count bigint,
    current_share_percent numeric,
    previous_share_percent numeric,
    delta_share_points numeric,
    delta_count bigint
)
language sql
security definer
set search_path = public
as $$
    with bounds as (
        select least(greatest(coalesce(p_days, 30), 1), 365) as days
    ),
    current_period as (
        select public.normalize_problem_category(reports.problem_type, reports.problem_text) as problem_type
        from public.reports as reports
        cross join bounds
        where reports.created_at >= timezone('utc', now()) - make_interval(days => bounds.days)
    ),
    previous_period as (
        select public.normalize_problem_category(reports.problem_type, reports.problem_text) as problem_type
        from public.reports as reports
        cross join bounds
        where reports.created_at < timezone('utc', now()) - make_interval(days => bounds.days)
            and reports.created_at >= timezone('utc', now()) - make_interval(days => bounds.days * 2)
    ),
    current_counts as (
        select current_period.problem_type, count(*)::bigint as current_count
        from current_period
        group by current_period.problem_type
    ),
    previous_counts as (
        select previous_period.problem_type, count(*)::bigint as previous_count
        from previous_period
        group by previous_period.problem_type
    ),
    categories as (
        select current_counts.problem_type from current_counts
        union
        select previous_counts.problem_type from previous_counts
    ),
    totals as (
        select
            coalesce((select sum(current_counts.current_count) from current_counts), 0)::bigint as current_total,
            coalesce((select sum(previous_counts.previous_count) from previous_counts), 0)::bigint as previous_total
    )
    select
        categories.problem_type,
        coalesce(current_counts.current_count, 0)::bigint as current_count,
        coalesce(previous_counts.previous_count, 0)::bigint as previous_count,
        case
            when totals.current_total = 0 then 0::numeric
            else round((coalesce(current_counts.current_count, 0)::numeric * 100.0) / totals.current_total, 1)
        end as current_share_percent,
        case
            when totals.previous_total = 0 then 0::numeric
            else round((coalesce(previous_counts.previous_count, 0)::numeric * 100.0) / totals.previous_total, 1)
        end as previous_share_percent,
        round(
            case
                when totals.current_total = 0 and totals.previous_total = 0 then 0::numeric
                else
                    (case
                        when totals.current_total = 0 then 0::numeric
                        else (coalesce(current_counts.current_count, 0)::numeric * 100.0) / totals.current_total
                    end)
                    -
                    (case
                        when totals.previous_total = 0 then 0::numeric
                        else (coalesce(previous_counts.previous_count, 0)::numeric * 100.0) / totals.previous_total
                    end)
            end,
            1
        ) as delta_share_points,
        (coalesce(current_counts.current_count, 0) - coalesce(previous_counts.previous_count, 0))::bigint as delta_count
    from categories
    left join current_counts on current_counts.problem_type = categories.problem_type
    left join previous_counts on previous_counts.problem_type = categories.problem_type
    cross join totals
    order by delta_share_points desc, current_count desc, categories.problem_type asc;
$$;

create or replace function public.get_problem_time_segments(p_days integer default 30)
returns table (
    segment_index integer,
    segment_label text,
    start_hour integer,
    end_hour integer,
    problem_count bigint,
    share_percent numeric
)
language sql
security definer
set search_path = public
as $$
    with bounds as (
        select least(greatest(coalesce(p_days, 30), 1), 365) as days
    ),
    segments as (
        select
            segment_index,
            segment_index * 2 as start_hour,
            (segment_index * 2 + 2) % 24 as end_hour
        from generate_series(0, 11) as series(segment_index)
    ),
    filtered_reports as (
        select floor(extract(hour from timezone('Europe/Tallinn', reports.created_at)) / 2.0)::integer as segment_index
        from public.reports as reports
        cross join bounds
        where reports.created_at >= timezone('utc', now()) - make_interval(days => bounds.days)
    ),
    counts as (
        select filtered_reports.segment_index, count(*)::bigint as problem_count
        from filtered_reports
        group by filtered_reports.segment_index
    ),
    totals as (
        select coalesce(sum(counts.problem_count), 0)::bigint as total_reports
        from counts
    )
    select
        segments.segment_index,
        lpad(segments.start_hour::text, 2, '0') || '–' || lpad(segments.end_hour::text, 2, '0') as segment_label,
        segments.start_hour,
        segments.end_hour,
        coalesce(counts.problem_count, 0)::bigint as problem_count,
        case
            when totals.total_reports = 0 then 0::numeric
            else round((coalesce(counts.problem_count, 0)::numeric * 100.0) / totals.total_reports, 1)
        end as share_percent
    from segments
    left join counts on counts.segment_index = segments.segment_index
    cross join totals
    order by segments.segment_index asc;
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
grant execute on function public.get_problem_category_stats(integer) to anon, authenticated;
grant execute on function public.get_problem_category_trends(integer) to anon, authenticated;
grant execute on function public.get_problem_time_segments(integer) to anon, authenticated;
grant execute on function public.get_recent_problem_reports(integer) to anon, authenticated;
grant execute on function public.submit_report_rating(uuid, uuid, smallint) to anon, authenticated;

create table if not exists public.interviews (
    id uuid primary key default gen_random_uuid(),
    invite_email text not null,
    invite_email_normalized text not null,
    invite_name text,
    brief text,
    admin_notes text,
    invite_token_hash text unique,
    invite_token_expires_at timestamptz,
    invite_sent_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    submitted_at timestamptz,
    published_at timestamptz,
    resend_message_id text,
    status text not null default 'draft' check (
        status in ('draft', 'invited', 'in_progress', 'awaiting_images', 'ready_for_review', 'published', 'archived', 'cancelled')
    ),
    transcript_summary text,
    subject_name text,
    story_payload jsonb not null default '{}'::jsonb,
    cover_asset_slot smallint not null default 1 check (cover_asset_slot in (1, 2)),
    editorial_item_id uuid references public.editorial_items(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists interviews_status_updated_idx
on public.interviews (status, updated_at desc);

create index if not exists interviews_invite_email_idx
on public.interviews (invite_email_normalized);

create table if not exists public.interview_messages (
    id uuid primary key default gen_random_uuid(),
    interview_id uuid not null references public.interviews(id) on delete cascade,
    role text not null check (
        role in ('assistant', 'user')
    ),
    content text not null check (char_length(content) <= 6000),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists interview_messages_interview_created_idx
on public.interview_messages (interview_id, created_at asc);

create table if not exists public.interview_assets (
    id uuid primary key default gen_random_uuid(),
    interview_id uuid not null references public.interviews(id) on delete cascade,
    slot smallint not null check (slot in (1, 2)),
    storage_bucket text not null,
    storage_path text not null unique,
    mime_type text not null,
    original_file_name text,
    byte_size bigint not null default 0,
    caption text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (interview_id, slot)
);

create index if not exists interview_assets_interview_created_idx
on public.interview_assets (interview_id, created_at asc);

drop trigger if exists set_interviews_updated_at on public.interviews;
create trigger set_interviews_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at();

drop trigger if exists set_interview_assets_updated_at on public.interview_assets;
create trigger set_interview_assets_updated_at
before update on public.interview_assets
for each row
execute function public.set_updated_at();

alter table public.interviews enable row level security;
alter table public.interview_messages enable row level security;
alter table public.interview_assets enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'interview-uploads',
    'interview-uploads',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
