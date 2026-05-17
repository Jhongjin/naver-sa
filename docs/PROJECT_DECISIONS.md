# Project Decisions

## Repository

- Repository: `https://github.com/Jhongjin/naver-sa.git`
- Default branch: `main`
- Current workflow: direct push is allowed during early scaffolding.
- Recommended later workflow: feature branches, draft PRs, then reviewed merge when the product becomes production-sensitive.

## Product North Star

Build a Naver SA automation platform that turns work normally handled by many operators into a workflow one marketer can manage.

Core promise:

> From setup to operation in one flow: keyword selection, campaign structure, ad copy, forecasting, deployment preparation, and optimization recommendations.

## Brand

- Product name: Naver SA Autopilot

## MVP Target

The product targets both:

- agency operators
- advertisers

Implementation bias:

- Build the data model and workspace for agency-style multi-account management.
- Keep the user experience simple enough for advertiser self-service.
- UI language: Korean.
- Code and documentation language: English.

## First Ad Product Scope

MVP priority:

1. Powerlink / Site Search Ads
2. Shopping Search Ads setup assistant
3. Shopping mall vertical first
4. Other verticals later

First sample site:

- `https://mard.at/`

Still excluded from first build:

- Brand Search full automation
- Place Ads full automation
- Shopping Search live/full automation

Shopping Search MVP support means:

- product-type switch in the setup workbench
- Shopping Search campaign/ad group draft generation
- read-only product group inventory lookup
- product group and shopping business channel selection before staged execution
- no live activation and no destructive mutation

## Naver Search Ad API

Status:

- API credentials are registered in Vercel.
- Test account is available.
- Test campaign creation is allowed.
- Live spending is not allowed.
- Account currently has no meaningful ad budget.

Safety:

- No live campaign activation in MVP without explicit human confirmation.
- No destructive deletes.
- Use pause/off instead of delete.

## Supabase

Status:

- Supabase project is connected.
- Git integration is connected.
- Database can be designed from scratch.

## Vercel

Status:

- Vercel project is connected to GitHub.
- Environment variables are registered.
- Current deployment URL: `https://naver-sa-git-main-jeonhongjins-projects.vercel.app/`

## AI

Status:

- OpenAI API is available.
- Cost limits are already controlled externally.

Allowed AI uses:

- keyword classification
- keyword grouping
- ad copy generation
- campaign structure drafting
- forecast explanation
- report drafting
- optimization recommendation rationale

## Competitive References

Important benchmark products:

- Hellomax
- ROASKill
- Boraware
- NABUS

Positioning difference:

- The product should focus more deeply on setup-to-operation workflow automation, not only bidding or reporting.
- The product should serve operator productivity, not only beginner-friendly AI chat.

Current MVP implementation status:

- Implemented: membership auth, signup confirmation resend, admin email confirmation fallback, admin member invite, my page session/retry/email-confirmation status, admin user management with user/activity filters and CSV export, admin operational health panel, recent account scan panel with snapshot diff summaries, recent admin audit event panel with summary/export, setup planner, keyword/search-query expansion/classification, ad group draft, bid/budget guardrails, approval queue, current-step execution rail, CSV/Excel/Markdown/PDF-ready report exports, dry-run optimization recommendations, Naver execution payload preview, protected test execution route, Naver API readiness layer, admin read-only Naver campaign check, Shopping Search product-group scan, Supabase planning/audit/execution history schema, Naver account snapshot history schema, dry-run Naver performance sync planning schema/routes, protected read-only Naver stats preview route with safe recommendations and approval-only draft suggestions, URL-synced searchable saved history browser, execution draft detail with payload inspection and audit counts, saved draft success summaries, explicit no-store API method handlers, and performance safety checks in `npm run verify`.
- Partial: real performance sync execution, live bidding automation, and multi-account role separation beyond the current workspace membership model.
- Planned: scheduled read-only Naver performance sync, performance-based bidding recommendations, share-link reports, deeper execution audit analytics, and production live-mode approval workflow.

Recent operational queue:

- Admin users can invite members by email without exposing invite links or tokens.
- Admin user actions are written to `audit_events` as `admin.user.*` events.
- Naver account scans are persisted to `naver_account_snapshots` when the optional table is available.
- Naver account scan history compares the latest scan with the nearest matching previous scan by user/product/brand/site context.
- Supabase readiness reports optional snapshot-history support without failing overall readiness.
- Supabase readiness reports optional performance-sync planning support without failing overall readiness.
- Performance sync planning stores dry-run requests only; Naver stat/master report job creation and deletion remain blocked.
- Performance stats preview can call only `GET /api/stats` after an admin provides explicit entity IDs; missing IDs block before any external request.
- Performance stats recommendations and their approval draft suggestions are safe-draft-only and never create, update, or delete Naver entities.
- Performance preview results can be re-run from saved history rows and exported as Markdown operating notes without including raw stats JSON.
- Admin performance sync plans can be filtered by status/scope and exported as CSV for operating review.
- Performance sync readiness now exposes scheduler state, but automatic cron execution remains off until target IDs, cadence, and failure notification policy are confirmed.
- Saved history detail supports authenticated internal link copy and Markdown operating memo export without embedding raw payload bodies.
- Admin recent saved activities can be exported as a filter-aware CSV for handoff and QA review.
- Admin account snapshot history can be exported as CSV with counts, diff summaries, and warning scopes.
- Admin audit events can be filtered by event type, and CSV export follows the active audit filter.
- Workspace auto-save status now updates with the latest local draft save timestamp instead of only the first restored timestamp.
- Workspace local draft reset now asks for confirmation before clearing input, approval decisions, and connection IDs.
- Account scan results can copy all discovered campaign IDs or open the admin performance preview with those IDs prefilled.
- API route files explicitly export common method handlers so unsupported methods return no-store 405 responses instead of Next.js default cacheable responses.
- Production verification after each queue checks `/api/health`, `/api/supabase/readiness`, and the relevant protected API route for no-store authentication/method behavior.

## UX Direction

Target UX:

- a practical operator dashboard
- advertiser-friendly explanations
- approval-first automation
- clear before/after work reduction

Avoid:

- vague AI assistant experience
- black-box autonomous spending
- complex screens that recreate the Naver Ads UI without simplifying the workflow
