-- Persist the operator-selected execution context used to validate staged Naver drafts.
-- This only adds metadata for saved history review; it does not execute, delete, or mutate Naver entities.

alter table public.execution_drafts
  add column if not exists execution_context jsonb not null default '{}'::jsonb;

comment on column public.execution_drafts.execution_context is
  'Operator-selected campaign, channel, and shopping product-group IDs used when the execution draft was prepared.';
