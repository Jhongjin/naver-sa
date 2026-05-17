-- Naver SA Autopilot Supabase manual setup.
-- Use this file in the Supabase SQL Editor when a project needs a fresh
-- schema install or a safe schema repair. It is idempotent and keeps the MVP
-- rule: no live ad execution, no deletion, and no secret values in SQL.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null default 'agency' check (mode in ('agency', 'advertiser')),
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces
  add column if not exists owner_user_id uuid;

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
  product_type text not null default 'powerlink',
  created_by text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  constraint planning_runs_product_type_check
    check (product_type in ('powerlink', 'shoppingSearch'))
);

alter table public.planning_runs
  add column if not exists product_type text not null default 'powerlink';

alter table public.planning_runs
  add column if not exists created_by_user_id uuid;

update public.planning_runs
set product_type = 'powerlink'
where product_type is null;

alter table public.planning_runs
  alter column product_type set default 'powerlink';

alter table public.planning_runs
  alter column product_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planning_runs_product_type_check'
      and conrelid = 'public.planning_runs'::regclass
  ) then
    alter table public.planning_runs
      add constraint planning_runs_product_type_check
      check (product_type in ('powerlink', 'shoppingSearch'));
  end if;
end $$;

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
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'held', 'executed', 'failed')),
  decided_at timestamptz,
  decided_by text,
  decision_note text,
  decision_source text not null default 'workspace',
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staged_changes
  add column if not exists decided_by text,
  add column if not exists decision_note text,
  add column if not exists decision_source text not null default 'workspace';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staged_changes_decision_source_check'
      and conrelid = 'public.staged_changes'::regclass
  ) then
    alter table public.staged_changes
      add constraint staged_changes_decision_source_check
      check (decision_source in ('workspace', 'api', 'import', 'system'));
  end if;
end $$;

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

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  email text,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  check (role in ('owner', 'admin', 'member', 'viewer'))
);

create table if not exists public.execution_drafts (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  draft_key text not null unique,
  draft_id text not null,
  brand_name text not null,
  approved_change_count integer not null default 0,
  status text not null default 'blocked'
    check (status in ('blocked', 'ready', 'executed', 'failed')),
  validation jsonb not null default '{}'::jsonb,
  blocked jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.execution_payloads (
  id uuid primary key default gen_random_uuid(),
  execution_draft_id uuid not null references public.execution_drafts(id) on delete cascade,
  payload_key text not null,
  idempotency_key text not null,
  method text not null check (method in ('POST', 'PUT')),
  uri text not null,
  entity_type text not null,
  target text not null,
  params jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (execution_draft_id, payload_key)
);

create table if not exists public.execution_results (
  id uuid primary key default gen_random_uuid(),
  execution_draft_id uuid references public.execution_drafts(id) on delete set null,
  idempotency_key text not null,
  payload_key text not null,
  ok boolean not null default false,
  status integer not null,
  target text not null,
  naver_entity_id text,
  error text,
  response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.naver_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  actor_email text,
  product_type text check (product_type in ('powerlink', 'shoppingSearch')),
  brand_name text,
  site_url text,
  partial boolean not null default false,
  external_request boolean not null default true,
  channels jsonb not null default '[]'::jsonb,
  campaigns jsonb not null default '[]'::jsonb,
  product_groups jsonb not null default '[]'::jsonb,
  errors jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

alter table public.execution_payloads
  drop constraint if exists execution_payloads_idempotency_key_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_drafts_draft_key_key'
      and conrelid = 'public.execution_drafts'::regclass
  ) then
    alter table public.execution_drafts
      add constraint execution_drafts_draft_key_key unique (draft_key);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_payloads_execution_draft_id_payload_key_key'
      and conrelid = 'public.execution_payloads'::regclass
  ) then
    alter table public.execution_payloads
      add constraint execution_payloads_execution_draft_id_payload_key_key
      unique (execution_draft_id, payload_key);
  end if;
end $$;

alter table public.workspaces enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.planning_runs enable row level security;
alter table public.planning_keywords enable row level security;
alter table public.planning_ad_groups enable row level security;
alter table public.staged_changes enable row level security;
alter table public.audit_events enable row level security;
alter table public.execution_drafts enable row level security;
alter table public.execution_payloads enable row level security;
alter table public.execution_results enable row level security;
alter table public.workspace_members enable row level security;
alter table public.naver_account_snapshots enable row level security;
alter table public.naver_performance_sync_runs enable row level security;

create index if not exists planning_runs_created_at_idx
  on public.planning_runs(created_at desc);
create index if not exists planning_keywords_run_status_idx
  on public.planning_keywords(planning_run_id, status);
create index if not exists staged_changes_run_decision_idx
  on public.staged_changes(planning_run_id, decision);
create index if not exists staged_changes_decided_by_idx
  on public.staged_changes(decided_by)
  where decided_by is not null;
create index if not exists staged_changes_decided_at_idx
  on public.staged_changes(decided_at desc)
  where decided_at is not null;
create index if not exists audit_events_created_at_idx
  on public.audit_events(created_at desc);
create index if not exists execution_drafts_run_idx
  on public.execution_drafts(planning_run_id, created_at desc);
create index if not exists execution_payloads_draft_idx
  on public.execution_payloads(execution_draft_id);
create index if not exists execution_payloads_idempotency_idx
  on public.execution_payloads(idempotency_key);
create index if not exists execution_results_idempotency_idx
  on public.execution_results(idempotency_key, created_at desc);
create index if not exists workspaces_owner_user_id_idx
  on public.workspaces(owner_user_id)
  where owner_user_id is not null;
create index if not exists planning_runs_created_by_user_id_idx
  on public.planning_runs(created_by_user_id, created_at desc)
  where created_by_user_id is not null;
create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);
create index if not exists naver_account_snapshots_user_created_idx
  on public.naver_account_snapshots(user_id, created_at desc);
create index if not exists naver_account_snapshots_product_created_idx
  on public.naver_account_snapshots(product_type, created_at desc)
  where product_type is not null;
create index if not exists naver_performance_sync_runs_user_created_idx
  on public.naver_performance_sync_runs(user_id, created_at desc);
create index if not exists naver_performance_sync_runs_status_created_idx
  on public.naver_performance_sync_runs(status, created_at desc);

-- Optional admin bootstrap after a user signs up through /signup.
-- Prefer ADMIN_EMAILS in Vercel for the first admin. Use this SQL only when
-- you need to set the role directly in Supabase Auth.
--
-- update auth.users
-- set raw_app_meta_data =
--   coalesce(raw_app_meta_data, '{}'::jsonb)
--   || jsonb_build_object('role', 'admin')
-- where lower(email) = lower('ADMIN_EMAIL_HERE');
--
-- select id, email, raw_app_meta_data ->> 'role' as role
-- from auth.users
-- where lower(email) = lower('ADMIN_EMAIL_HERE');

-- Verification helpers.
--
-- select
--   to_regclass('public.workspaces') as workspaces,
--   to_regclass('public.planning_runs') as planning_runs,
--   to_regclass('public.execution_drafts') as execution_drafts,
--   to_regclass('public.execution_payloads') as execution_payloads,
--   to_regclass('public.naver_account_snapshots') as naver_account_snapshots,
--   to_regclass('public.naver_performance_sync_runs') as naver_performance_sync_runs;
--
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'planning_runs'
--   and column_name = 'product_type';
--
-- select conname
-- from pg_constraint
-- where conrelid = 'public.execution_payloads'::regclass
--   and conname = 'execution_payloads_idempotency_key_key';
--
-- select indexname
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'execution_payloads'
--   and indexname = 'execution_payloads_idempotency_idx';
