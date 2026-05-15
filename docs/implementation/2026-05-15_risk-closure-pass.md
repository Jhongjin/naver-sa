# Risk Closure Pass

Date: 2026-05-15

## Scope

- Extended Supabase readiness checks to include execution history tables and the `planning_runs.product_type` column.
- Added explicit operator session role, capability, TTL, and guardrail metadata.
- Added advertiser/internal report export paths for PDF print and Excel-compatible `.xls`, while keeping Markdown export.
- Added a browser-side operator session check so operators can validate access without exposing the code in chat or logs.

## Safety Notes

- No environment values, API keys, tokens, or credentials are logged or committed.
- Live campaign activation remains blocked.
- Production deletion remains blocked.
- Test entity creation is still disabled in the browser-facing operator session.
- Supabase migration verification is read-only and reports missing tables/columns without changing data.

## Verification Targets

- `/api/supabase/readiness` should return `ok: true` only when all required tables and columns are present.
- `/api/operator/session` should require `OPERATOR_ACCESS_CODE` and return blocked live/delete capabilities.
- The execution inspector should show `세션 확인` and surface operator capabilities before account scan or history save.
- The report panel should expose `PDF`, `Excel`, and `Markdown` export actions.

## Rollback

- Revert the commit for this pass, or restore from the pushed backup branch created before this risk closure pass.
