-- Naver performance sync planning groundwork.
-- Safe to run repeatedly; stores dry-run sync plans and never creates, updates, or deletes Naver entities.

create table if not exists public.naver_performance_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  actor_email text,
  product_type text check (product_type in ('powerlink', 'shoppingSearch')),
  brand_name text,
  site_url text,
  scope text not null default 'powerlinkDailyStats'
    check (scope in ('powerlinkDailyStats', 'shoppingKeywordDailyStats', 'masterReference')),
  requested_from date not null,
  requested_to date not null,
  status text not null default 'planned'
    check (status in ('planned', 'blocked', 'ready', 'failed', 'completed')),
  external_request boolean not null default false,
  read_only_endpoint text not null,
  entity_ids text[] not null default '{}',
  fields text[] not null default '{}',
  safeguards jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}',
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_from <= requested_to)
);

alter table public.naver_performance_sync_runs enable row level security;

create index if not exists naver_performance_sync_runs_user_created_idx
  on public.naver_performance_sync_runs(user_id, created_at desc);

create index if not exists naver_performance_sync_runs_status_created_idx
  on public.naver_performance_sync_runs(status, created_at desc);

comment on table public.naver_performance_sync_runs is
  'Dry-run Naver performance sync plans and readiness records. External report creation is blocked in MVP.';
