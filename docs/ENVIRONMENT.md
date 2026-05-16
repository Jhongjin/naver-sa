# Environment Variables

Do not commit real secret values. Use `.env.local` for local development and Vercel Environment Variables for deployed environments.

## Required In Vercel

### App

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Production, Preview | Deployed app URL. |
| `APP_ENV` | Production, Preview | `production`, `preview`, or `development`. |

### Supabase

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Safe to expose to browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Safe to expose to browser under Supabase RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never expose to browser. Use only in server routes or workers. |

### Naver Search Ad API

| Variable | Scope | Notes |
|---|---|---|
| `NAVER_SEARCH_AD_API_KEY` | Server only | Naver Search Ad API access key. |
| `NAVER_SEARCH_AD_SECRET_KEY` | Server only | Used to generate API signatures. Never expose to browser. |
| `NAVER_SEARCH_AD_CUSTOMER_ID` | Server only | Test advertiser customer ID. |
| `NAVER_SEARCH_AD_BASE_URL` | Server only | Usually `https://api.searchad.naver.com`. |

### AI

| Variable | Scope | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Server only | Used for keyword classification, grouping, copy generation, and rationale. |

### Security

| Variable | Scope | Notes |
|---|---|---|
| `CRON_SECRET` | Server only | Protects scheduled sync endpoints. |
| `ENCRYPTION_KEY` | Server only | Used for encrypting stored external credentials. |
| `ADMIN_EMAILS` | Server only | Recommended comma-separated admin allowlist for first 회원관리 bootstrap. User sessions still come from Supabase Auth. Alternatively set `app_metadata.role = admin` directly in Supabase. |

### Supabase Auth Setup

For membership-based access, configure Supabase Auth before inviting operators:

1. Enable the Email provider in Supabase Authentication.
2. Set the Supabase Site URL to `NEXT_PUBLIC_APP_URL`.
3. Add redirect URLs for the production domain, preview domain, `/login`, `/signup`, `/workspace`, and `/mypage`.
4. Decide whether email confirmation is required. If it is required, confirm SMTP/email delivery before launch.
5. Set `ADMIN_EMAILS` in Vercel for the first administrator, or manually set the first admin user metadata to `app_metadata.role = admin` in Supabase.
6. Verify `/api/auth/session` returns `401 AUTH_TOKEN_REQUIRED` without a token and succeeds after browser login.

Browser access uses Supabase Auth sessions. App data writes still go through server routes using the service role key, so public table RLS policies are intentionally not used for direct browser writes in the MVP.

## Should Naver API Keys Be Registered In Both Vercel And Supabase?

For MVP, register Naver API keys in Vercel only.

Reason:
- The app server should call the Naver Search Ad API.
- Supabase should store app data, not execute signed Naver API requests in the first version.

Register Naver keys in Supabase only if we later build Supabase Edge Functions that call the Naver API directly.

## Local Development

Create `.env.local` from `.env.example` and fill local values.

Never commit `.env.local`.
