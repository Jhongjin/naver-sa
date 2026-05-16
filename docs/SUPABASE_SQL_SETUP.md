# Supabase SQL Setup

Use this guide when Supabase needs a fresh schema install, a manual production
repair, or an admin role bootstrap.

Do not paste API keys, service role keys, Naver secrets, or operator codes into
SQL. This setup only creates database schema and optional Auth role metadata.

## Recommended Path

1. Open the target Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase/manual-setup.sql`.
4. Visit `/api/supabase/readiness` after the next deploy.
5. Confirm the response has `ok: true`.

The manual setup file is idempotent. It can be run again if:

- the project was paused and resumed,
- a table is missing,
- `planning_runs.product_type` is missing,
- `planning_runs.product_type` exists but lacks its default or not-null rule,
- the old global `execution_payloads.idempotency_key` unique constraint still exists.

## First Admin Options

The preferred bootstrap is the `ADMIN_EMAILS` Vercel environment variable. Add
the first administrator email there, then sign in through Supabase Auth.

If you need to set the role directly in Supabase SQL Editor after the user has
signed up, replace `ADMIN_EMAIL_HERE` and run:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin')
where lower(email) = lower('ADMIN_EMAIL_HERE');
```

Verify:

```sql
select id, email, raw_app_meta_data ->> 'role' as role
from auth.users
where lower(email) = lower('ADMIN_EMAIL_HERE');
```

Expected `role`:

```text
admin
```

## Schema Verification Queries

Check required tables:

```sql
select
  to_regclass('public.workspaces') as workspaces,
  to_regclass('public.planning_runs') as planning_runs,
  to_regclass('public.execution_drafts') as execution_drafts,
  to_regclass('public.execution_payloads') as execution_payloads,
  to_regclass('public.workspace_members') as workspace_members;
```

Check required membership and decision columns:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'planning_runs' and column_name in ('product_type', 'created_by_user_id'))
    or (table_name = 'workspaces' and column_name = 'owner_user_id')
    or (table_name = 'staged_changes' and column_name in ('decided_by', 'decision_note', 'decision_source'))
  )
order by table_name, column_name;
```

Check that the old duplicate-blocking payload constraint is gone:

```sql
select conname
from pg_constraint
where conrelid = 'public.execution_payloads'::regclass
  and conname = 'execution_payloads_idempotency_key_key';
```

Expected result:

```text
0 rows
```

Check that the replacement lookup index exists:

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'execution_payloads'
  and indexname = 'execution_payloads_idempotency_idx';
```

Expected `indexname`:

```text
execution_payloads_idempotency_idx
```

## Auth Readiness

Supabase Auth must be enabled for:

- `/workspace`
- `/mypage`
- `/admin/users`
- protected Naver scan, draft validation, and history save APIs

After setup, verify:

```text
/api/auth/session
/api/supabase/readiness
```

Unauthenticated `/api/auth/session` should return `401 AUTH_TOKEN_REQUIRED`.
Authenticated users should be accepted by the app pages and protected APIs.
