# Setup Guide

## 1. GitHub

Repository:

```text
https://github.com/Jhongjin/naver-sa.git
```

The repository was empty at initialization. Add the app skeleton before connecting deployment workflows.

## 2. Vercel Connection

1. Open Vercel Dashboard.
2. Go to the created project, or click `Add New...` > `Project`.
3. Choose `Import Git Repository`.
4. Select `Jhongjin/naver-sa`.
5. If the repository does not appear, install or update the Vercel GitHub integration permissions.
6. Framework preset should be `Next.js` after the app is scaffolded.
7. Add Environment Variables from `docs/ENVIRONMENT.md`.
8. Deploy.

If Vercel says there is no framework or build command, that is expected while the repository is empty. After the Next.js app is scaffolded, Vercel will detect it.

## 3. Supabase Connection

Supabase cannot infer project structure from an empty Git repository.

Recommended MVP setup:

1. Keep Supabase as the database/auth/storage backend.
2. Do not rely on Supabase Git integration yet.
3. Store schema migrations inside this repository after the app skeleton is created.
4. Use Supabase Project URL and anon key in Vercel env vars.
5. Use service role key only in server-side code.

## 4. Naver Search Ad API

Use these variable names:

```text
NAVER_SEARCH_AD_API_KEY
NAVER_SEARCH_AD_SECRET_KEY
NAVER_SEARCH_AD_CUSTOMER_ID
NAVER_SEARCH_AD_BASE_URL
```

For MVP, add them to Vercel Environment Variables and `.env.local`.

Do not add them to Supabase unless we later use Supabase Edge Functions for Naver API calls.

## 5. Recommended Next Step

Initialize the Next.js app in this repository, then connect Vercel.

