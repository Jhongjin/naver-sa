-- Persist planner metadata used by saved operating reports.
-- This stores generated planning guidance only and does not call or mutate Naver.

alter table public.planning_runs
  add column if not exists industry_template jsonb not null default '{}'::jsonb,
  add column if not exists benchmark_features jsonb not null default '[]'::jsonb,
  add column if not exists operation_rules jsonb not null default '[]'::jsonb;

comment on column public.planning_runs.industry_template is
  'Planner-generated industry template used when the saved run was created.';

comment on column public.planning_runs.benchmark_features is
  'Planner-generated MVP benchmark feature checklist for saved report review.';

comment on column public.planning_runs.operation_rules is
  'Planner-generated operating rules and automation levels for saved report review.';
