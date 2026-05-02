-- Naver SA Autopilot planning and approval history.
-- This migration only creates new tables. It does not delete or mutate production data.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null default 'agency' check (mode in ('agency', 'advertiser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  provider text not null default 'naver_search_ad',
  customer_id text,
  label text not null,
  is_live_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  ad_account_id uuid references public.ad_accounts(id),
  brand_name text not null,
  site_url text not null,
  vertical text not null,
  monthly_budget integer not null,
  max_bid integer not null,
  mode text not null check (mode in ('agency', 'advertiser')),
  seed_keywords text[] not null default '{}',
  forecast jsonb not null default '{}'::jsonb,
  assumptions text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_keywords (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  term text not null,
  intent text not null,
  ad_group_name text not null,
  match_type text not null,
  bid integer not null,
  expected_impressions integer not null,
  expected_clicks integer not null,
  expected_cost integer not null,
  cvr numeric not null,
  confidence integer not null,
  status text not null check (status in ('include', 'review', 'exclude')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_ad_groups (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  name text not null,
  description text not null,
  monthly_budget integer not null,
  daily_budget integer not null,
  keyword_count integer not null,
  expected_clicks integer not null,
  avg_bid integer not null,
  sample_ads jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.staged_changes (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  external_key text not null,
  entity_type text not null,
  target text not null,
  action text not null,
  risk text not null check (risk in ('low', 'medium', 'blocked')),
  approval_required boolean not null default true,
  details text not null,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'held', 'executed', 'failed')),
  decided_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  event_type text not null,
  actor text,
  entity_type text,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.planning_runs enable row level security;
alter table public.planning_keywords enable row level security;
alter table public.planning_ad_groups enable row level security;
alter table public.staged_changes enable row level security;
alter table public.audit_events enable row level security;

create index if not exists planning_runs_created_at_idx on public.planning_runs(created_at desc);
create index if not exists planning_keywords_run_status_idx on public.planning_keywords(planning_run_id, status);
create index if not exists staged_changes_run_decision_idx on public.staged_changes(planning_run_id, decision);
create index if not exists audit_events_created_at_idx on public.audit_events(created_at desc);
