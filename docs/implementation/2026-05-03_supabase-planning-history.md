# Supabase Planning History Foundation

Date: 2026-05-03

## Scope

Added persistence groundwork for planning runs, staged changes, and audit history.

Implemented:

- Supabase migration for planning and audit tables
- server-only Supabase admin client
- planning run persistence helper
- protected `POST /api/plans/store` route
- production readiness check at `GET /api/supabase/readiness`

## Safety

- The migration only creates new tables and indexes.
- No production data deletion or destructive migration is included.
- RLS is enabled on all new tables.
- The legacy storage route requires an authenticated Supabase Auth admin session and ignores caller-provided user IDs.
- The storage route regenerates the plan server-side from submitted input instead of trusting client-provided generated rows.
- The browser UI uses `/api/plans/store-draft` with the signed-in user's Supabase Auth session.
- The readiness route returns table presence and counts only. It does not return table rows or secrets.

## Tables

- `workspaces`
- `ad_accounts`
- `planning_runs`
- `planning_keywords`
- `planning_ad_groups`
- `staged_changes`
- `audit_events`

## Next Step

Define authentication and tenant policies before exposing persistence through the UI.

After applying the migration, verify:

```text
GET /api/supabase/readiness
```

Expected result:

```json
{
  "ok": true,
  "tables": [
    { "name": "workspaces", "present": true }
  ]
}
```
