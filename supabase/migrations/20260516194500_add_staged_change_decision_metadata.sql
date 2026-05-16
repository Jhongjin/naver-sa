-- Decision metadata for approval queue items.
-- Safe to run repeatedly; does not delete or mutate existing production data.

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

create index if not exists staged_changes_decided_by_idx
  on public.staged_changes(decided_by)
  where decided_by is not null;

create index if not exists staged_changes_decided_at_idx
  on public.staged_changes(decided_at desc)
  where decided_at is not null;

comment on column public.staged_changes.decided_by is
  'User email or id that saved the approval decision.';

comment on column public.staged_changes.decision_note is
  'Optional operator note explaining an approval or hold decision.';

comment on column public.staged_changes.decision_source is
  'Source that captured the approval decision.';
