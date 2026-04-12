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
