-- Naver account snapshot history.
-- Safe to run repeatedly; stores read-only inventory scan results and never mutates Naver entities.

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

alter table public.naver_account_snapshots enable row level security;

create index if not exists naver_account_snapshots_user_created_idx
  on public.naver_account_snapshots(user_id, created_at desc);

create index if not exists naver_account_snapshots_product_created_idx
  on public.naver_account_snapshots(product_type, created_at desc)
  where product_type is not null;

comment on table public.naver_account_snapshots is
  'Read-only Naver account inventory scan snapshots for audit and troubleshooting.';
