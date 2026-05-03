# Safe Production Verification Plan

Date: 2026-05-03

## Why This Plan Exists

The local machine cannot safely pull Vercel production secrets because the network path presents a self-signed certificate chain and the trusted root certificate is not available.

We will not pull production secrets with TLS verification disabled.

## Chosen Alternative

Keep secrets inside hosted services and verify production from the deployment itself.

This means:

- do not copy Vercel production env values to local `.env.local`
- keep Naver, Supabase, OpenAI, CRON, and encryption secrets only in Vercel/Supabase dashboards
- use `/api/health` in the deployed app to check variable presence only
- use `/api/naver/readiness` in the deployed app for non-mutating readiness checks
- apply Supabase migration through Supabase dashboard or trusted CI, not through a local TLS-bypassed CLI

## Required Manual Actions

### 1. Vercel Deployment Protection

Current production URL returned HTTP 401 during remote verification.

In Vercel dashboard:

1. Open project `naver-sa`
2. Go to Settings
3. Open Deployment Protection or Security settings
4. Disable protection for the production domain, or create a temporary share URL
5. Re-test:

```text
https://naver-sa-git-main-jeonhongjins-projects.vercel.app/api/health
```

Expected response:

```json
{
  "ok": true,
  "variables": [
    { "name": "NEXT_PUBLIC_APP_URL", "present": true }
  ]
}
```

The endpoint returns presence flags only, never secret values.

### 2. Vercel Environment Variables

In Vercel dashboard, confirm these variables exist for Production:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NAVER_SEARCH_AD_API_KEY`
- `NAVER_SEARCH_AD_SECRET_KEY`
- `NAVER_SEARCH_AD_CUSTOMER_ID`
- `NAVER_SEARCH_AD_BASE_URL`
- `OPENAI_API_KEY`
- `CRON_SECRET`
- `ENCRYPTION_KEY`

Do not paste values into chat or commit them.

### 3. Supabase Migration

Apply this migration in Supabase SQL editor:

```text
supabase/migrations/20260503011200_create_planning_tables.sql
```

The migration only creates new tables, indexes, and RLS enablement. It does not delete production data.

### 4. Naver Readiness

After Production env is confirmed, test:

```text
https://naver-sa-git-main-jeonhongjins-projects.vercel.app/api/naver/readiness
```

This does not call Naver externally.

Only after explicit confirmation, test the read-only external check:

```text
https://naver-sa-git-main-jeonhongjins-projects.vercel.app/api/naver/readiness?check=campaigns
```

This sends signed Naver API headers to Naver, but does not create or modify ads.

### 5. Test Execution

Do not call:

```text
POST /api/naver/execute-draft
```

until the user explicitly approves a test-account-only execution.

## Current Local State

The local `.env.local` contains only `VERCEL_OIDC_TOKEN` from Vercel development env pull and is not sufficient for Naver/Supabase production verification.

`.env.local` and `.vercel/` are ignored by git.

## Rollback

Code rollback:

```bash
git revert <commit>
```

Supabase rollback, if the migration was applied:

- disable app writes first
- drop newly created MVP tables only after confirming no production data is needed
- keep an export of all planning/audit data before any drop
