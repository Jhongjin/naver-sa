-- Limited public report share links for saved planning runs.
-- Safe to run repeatedly. Stores token hashes only and never stores raw payload data.

create table if not exists public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  created_by_user_id uuid not null,
  created_by_email text,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.report_share_links enable row level security;

create index if not exists report_share_links_run_created_idx
  on public.report_share_links(planning_run_id, created_at desc);

create index if not exists report_share_links_token_hash_idx
  on public.report_share_links(token_hash);

create index if not exists report_share_links_status_expires_idx
  on public.report_share_links(status, expires_at);

comment on table public.report_share_links is
  'Token-hash based limited public report shares. Public reports exclude raw execution payload bodies and internal audit data.';
