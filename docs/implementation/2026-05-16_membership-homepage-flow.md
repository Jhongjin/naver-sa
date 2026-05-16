# Membership Homepage And Execution Flow

Date: 2026-05-16

## Scope

Converted browser-facing protected workflows from operator-code entry to Supabase Auth session headers.

Added:

- homepage at `/`
- signup at `/signup`
- login at `/login`
- authenticated workspace at `/workspace`
- my page at `/mypage`
- admin user management at `/admin/users`
- `/api/auth/session`
- `/api/admin/users`

## Workflow UI

The workspace now centers the operational path in one execution rail:

1. approval
2. account scan
3. draft validation
4. history save

The older scattered operator-code/session controls were removed from the visible workspace.

## Safety

- Live campaign activation remains blocked.
- Delete execution remains blocked.
- Protected browser routes require a signed-in Supabase user session.
- Admin user management requires `ADMIN_EMAILS` or Supabase `app_metadata.role = admin`.
