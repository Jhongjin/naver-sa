-- Workspace ownership and membership metadata.
-- Safe to run repeatedly; does not delete or mutate existing production data.

alter table public.workspaces
  add column if not exists owner_user_id uuid;

alter table public.planning_runs
  add column if not exists created_by_user_id uuid;

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

alter table public.workspace_members enable row level security;

create index if not exists workspaces_owner_user_id_idx
  on public.workspaces(owner_user_id)
  where owner_user_id is not null;

create index if not exists planning_runs_created_by_user_id_idx
  on public.planning_runs(created_by_user_id, created_at desc)
  where created_by_user_id is not null;

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

comment on column public.workspaces.owner_user_id is
  'Supabase auth user id that owns the workspace.';

comment on column public.planning_runs.created_by_user_id is
  'Supabase auth user id that created the planning run.';
