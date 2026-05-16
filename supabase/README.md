# Supabase

This directory contains the database migrations for Naver SA Autopilot.

## Migrations

Apply migrations in timestamp order:

```text
20260503011200_create_planning_tables.sql
20260515121000_create_execution_history_tables.sql
20260516101400_relax_execution_payload_idempotency.sql
```

## Production Apply Checklist

1. Open the Supabase project SQL Editor or run the Supabase CLI against the target project.
2. Apply each migration in timestamp order.
3. Confirm the `planning_runs.product_type` column exists.
4. Confirm `execution_payloads_idempotency_key_key` has been dropped.
5. Visit `/api/supabase/readiness` after deploy.

The MVP enables RLS on public app tables, but browser clients do not write to those tables directly. The app writes planning and execution history through protected server routes using `SUPABASE_SERVICE_ROLE_KEY`.

## Auth Checklist

Supabase Auth is required for `/workspace`, `/mypage`, and `/admin/users`.

- Enable Email Auth.
- Configure Site URL and redirect URLs for the deployed domains.
- Configure SMTP or verify Supabase email delivery before enabling email confirmation.
- Set `ADMIN_EMAILS` for the first admin, or set `app_metadata.role = admin` manually.
