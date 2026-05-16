# Naver SA Autopilot

Naver SA Autopilot is a setup-to-operation automation platform for Naver Search Ads, starting with Powerlink/Site Search Ads.

The MVP goal is to help agencies and advertisers generate, review, forecast, and deploy Naver SA campaign drafts with less manual work.

## Current Status

The first functional MVP workspace is implemented as a dry-run planner. It does not mutate Naver Ads, spend budget, or delete production data.

Implemented:

- digital product homepage at `/`
- Supabase Auth signup and login pages at `/signup` and `/login`
- authenticated workspace at `/workspace`
- account page at `/mypage`
- admin-only member management page at `/admin/users`
- interactive keyword planning workspace
- seed keyword expansion and intent classification
- campaign/ad group draft generation
- bid and budget guardrails
- forecast summary
- negative keyword suggestions
- approval queue for staged changes
- keyword CSV export
- approval queue CSV export
- Markdown setup report export
- internal dry-run preview API at `/api/plans/preview`
- Naver Search Ad read-only readiness API at `/api/naver/readiness`
- protected planning persistence API at `/api/plans/store`
- authenticated draft history API at `/api/plans/store-draft`
- Supabase planning table readiness API at `/api/supabase/readiness`
- Supabase planning/audit schema migration
- dry-run optimization recommendation engine
- approved Naver execution payload JSON preview
- protected test execution route at `/api/naver/execute-draft`

Planned stack:

- Next.js
- TypeScript
- Supabase
- Vercel
- Naver Search Ad API
- AI-assisted keyword grouping, campaign drafting, and copy generation

## Safety

- Live execution is blocked in MVP.
- All Naver API mutations must remain approval-first.
- Delete actions are not generated; use pause/off recommendations instead.
- Secrets must stay in Vercel/Supabase environment settings and must never be committed.
- Production secrets must not be pulled locally when TLS certificate verification is disabled.

## Setup Documents

- `docs/SETUP.md`
- `docs/ENVIRONMENT.md`
- `docs/OPERATING_POLICY.md`
- `docs/implementation/2026-05-03_safe-production-verification.md`
- `.env.example`
