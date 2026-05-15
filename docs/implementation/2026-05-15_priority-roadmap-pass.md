# Priority Roadmap Implementation Pass

## Scope
- Priority 1: approval queue filtering/search, saveable draft history route, clearer save failure states.
- Priority 2: Naver execution idempotency keys and execution result identifiers in protected execution responses.
- Priority 3: shopping search product-group recommendations and feed action guidance.
- Priority 4: powerlink industry templates, additional ad-copy angles, expanded negative keyword themes.
- Priority 5: operator session capability route and productization readiness panel.

## Database
Added a migration for execution draft, payload, and result history:
- `execution_drafts`
- `execution_payloads`
- `execution_results`

The migration is additive only. It does not delete or mutate production data.

## Safety
- Live campaign activation remains blocked.
- Delete execution remains blocked.
- Operator-code protected browser save route does not expose secrets.
- Naver mutation route still requires `CRON_SECRET` and explicit `TEST_EXECUTION_ONLY` confirmation.
- DB migration must be applied before persistent execution draft history can succeed in Supabase.

## Follow-Up
- Apply the Supabase migration in the dashboard or CLI.
- Replace operator-code access with real user identity before onboarding multiple operators.
- Replace Excel-compatible `.xls` export with true `.xlsx` generation if the reporting workflow needs formulas or multi-sheet styling.
