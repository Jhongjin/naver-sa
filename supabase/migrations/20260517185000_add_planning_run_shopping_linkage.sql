-- Store a safe Shopping Search linkage summary with each saved planning run.
-- This adds review metadata only; it does not call or mutate Naver.

alter table public.planning_runs
  add column if not exists shopping_linkage jsonb not null default '{}'::jsonb;

comment on column public.planning_runs.shopping_linkage is
  'Safe summary of the selected Shopping Search business-channel and product-group linkage used during draft preparation.';
