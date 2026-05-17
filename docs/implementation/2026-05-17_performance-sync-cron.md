# Scheduled Performance Sync Cron

## Scope

- Adds Vercel Cron for `/api/naver/performance-sync/cron`.
- Runs daily at `10 0 * * *` UTC, which is 09:10 KST.
- Selects `naver_performance_sync_runs` rows with `planned` or `failed` status.
- Limits each invocation to 3 rows.

## Safety

- Requires `Authorization: Bearer <CRON_SECRET>`.
- Calls only read-only Naver `GET /api/stats`.
- Excludes `blocked`, `completed`, `ready`, and `masterReference`.
- Does not create or delete report jobs.
- Does not store raw stats; only summary counts, recommendation summaries, and approval-only draft summaries are persisted.
- Writes `ops.performance_sync.failed` audit events for cron failures.

## Operations

- `/api/naver/performance-sync/readiness` reports `automaticCronConfigured`, `cronSecretPresent`, the schedule, and the per-run limit separately.
- The admin 예약 실행 card shows cron status, CRON_SECRET presence, target statuses, and the KST schedule.
- Recent cron outcomes are visible through performance plan rows and ops alert filters.
