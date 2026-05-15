-- Execution draft and result history for Naver SA Autopilot.
-- This migration only creates new tables/columns. It does not delete or mutate production data.

alter table public.planning_runs
  add column if not exists product_type text not null default 'powerlink'
  check (product_type in ('powerlink', 'shoppingSearch'));

create table if not exists public.execution_drafts (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  draft_key text not null unique,
  draft_id text not null,
  brand_name text not null,
  approved_change_count integer not null default 0,
  status text not null default 'blocked' check (status in ('blocked', 'ready', 'executed', 'failed')),
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
  unique (execution_draft_id, payload_key),
  unique (idempotency_key)
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

alter table public.execution_drafts enable row level security;
alter table public.execution_payloads enable row level security;
alter table public.execution_results enable row level security;

create index if not exists execution_drafts_run_idx on public.execution_drafts(planning_run_id, created_at desc);
create index if not exists execution_payloads_draft_idx on public.execution_payloads(execution_draft_id);
create index if not exists execution_results_idempotency_idx on public.execution_results(idempotency_key, created_at desc);
