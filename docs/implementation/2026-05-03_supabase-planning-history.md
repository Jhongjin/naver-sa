# Supabase Planning History Foundation

Date: 2026-05-03

## Scope

Added persistence groundwork for planning runs, staged changes, and audit history.

Implemented:

- Supabase migration for planning and audit tables
- server-only Supabase admin client
- planning run persistence helper
- protected `POST /api/plans/store` route

## Safety

- The migration only creates new tables and indexes.
- No production data deletion or destructive migration is included.
- RLS is enabled on all new tables.
- The storage route requires `x-admin-secret` matching `CRON_SECRET`.
- The storage route regenerates the plan server-side from submitted input instead of trusting client-provided generated rows.
- The route is not called by the browser UI yet.

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
