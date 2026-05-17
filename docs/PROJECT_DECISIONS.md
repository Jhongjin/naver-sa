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

- Implemented: membership auth, signup confirmation resend, admin email confirmation fallback, admin member invite, my page session/retry/email-confirmation status, admin user management with user/activity filters and CSV export, admin operational health panel, recent account scan panel with snapshot diff summaries, recent admin audit event panel with summary/export, in-app ops alert filtering, setup planner, keyword/search-query expansion/classification, ad group draft, bid/budget guardrails, approval queue, current-step execution rail, CSV/Excel/Markdown/PDF-ready report exports, dry-run optimization recommendations, Naver execution payload preview, protected test execution route, Naver API readiness layer, admin read-only Naver campaign check, Shopping Search product-group scan, Supabase planning/audit/execution history schema, Naver account snapshot history schema, dry-run Naver performance sync planning schema/routes, admin manual read-only performance sync queue, token-hash limited public report share links, protected read-only Naver stats preview route with safe recommendations and approval-only draft suggestions, URL-synced searchable saved history browser, execution draft detail with payload inspection and audit counts, saved draft success summaries, explicit no-store API method handlers, and performance safety checks in `npm run verify`.
- Partial: real performance sync execution beyond read-only stats, live bidding automation, and multi-account role separation beyond the current workspace membership model.
- Planned: performance-based bidding recommendations, deeper execution audit analytics, and production live-mode approval workflow.

Recent operational queue:

- Admin users can invite members by email without exposing invite links or tokens.
- Admin user actions are written to `audit_events` as `admin.user.*` events.
- Naver account scans are persisted to `naver_account_snapshots` when the optional table is available.
- Naver account scan history compares the latest scan with the nearest matching previous scan by user/product/brand/site context.
- Supabase readiness reports optional snapshot-history support without failing overall readiness.
- Supabase readiness reports optional performance-sync planning support without failing overall readiness.
- Performance sync planning stores dry-run requests only; Naver stat/master report job creation and deletion remain blocked.
- Planned performance sync rows can now be manually executed by an admin through read-only `GET /api/stats`; the same row is updated to completed/failed and raw stats are not stored.
- Manual performance sync failures and blocked attempts write `ops.performance_sync.*` audit events, and the admin event panel can filter them as operational alerts.
- Performance stats preview can call only `GET /api/stats` after an admin provides explicit entity IDs; missing IDs block before any external request.
- Performance stats recommendations and their approval draft suggestions are safe-draft-only and never create, update, or delete Naver entities.
- Performance preview results can be re-run from saved history rows and exported as Markdown operating notes without including raw stats JSON.
- Admin performance sync plans can be filtered by status/scope and exported as CSV for operating review.
- Performance sync readiness now exposes scheduler state, with Vercel Cron configured for `/api/naver/performance-sync/cron` at 09:10 KST daily. It processes up to 3 `planned` or `failed` rows through read-only `GET /api/stats`, excludes `blocked`, `completed`, `ready`, and `masterReference`, and records failure alerts as `ops.performance_sync.failed`.
- Performance sync plan rows now expose run source, sanitized error/status, queued time, and completed time in the admin UI and CSV so scheduled cron outcomes can be audited without raw stats storage. Each cron invocation also writes an `ops.performance_sync.cron_checked` heartbeat with processed and backlog counts.
- Saved history detail supports authenticated internal link copy and Markdown operating memo export without embedding raw payload bodies.
- Admin recent saved activities can be exported as a filter-aware CSV for handoff and QA review.
- Admin account snapshot history can be exported as CSV with counts, diff summaries, and warning scopes.
- Admin audit events can be filtered by event type, and CSV export follows the active audit filter.
- Workspace auto-save status now updates with the latest local draft save timestamp instead of only the first restored timestamp.
- Workspace local draft reset now asks for confirmation before clearing input, approval decisions, and connection IDs.
- Account scan results can copy all discovered campaign IDs or open the admin performance preview with those IDs prefilled.
- Saved history browser can copy the current URL-synced filter link for authenticated team handoff.
- Saved history detail can create and revoke 7-day limited public report links. Shared reports exclude raw payload bodies, idempotency keys, and internal audit event payloads.
- Supabase readiness reports optional limited report share-link support without failing overall readiness.
- API route files explicitly export common method handlers so unsupported methods return no-store 405 responses instead of Next.js default cacheable responses.
- Production verification after each queue checks `/api/health`, `/api/supabase/readiness`, and the relevant protected API route for no-store authentication/method behavior.
- Protected test execution now requires Supabase Auth admin access, a previously saved ready execution draft, no prior execution results for that draft, and the `TEST_EXECUTION_ONLY` confirmation phrase before any Naver mutation request can be sent.
- Naver Search Ad client calls now fail closed on timeout, abort, network failure, or invalid JSON, returning sanitized errors instead of letting external API failures crash cron, account scan, preview, or protected execution routes.
- Shopping Search product groups applied from account scans now carry their linked business channel into execution context; staged drafts block mismatched shopping channel/product-group pairs and warn when linkage was manually typed rather than scan-verified.
- Saved history detail now maps execution results by `execution_draft_id + payload_key`, preventing results from different drafts in the same planning run from appearing under the wrong payload.
- Account scan candidates are now fingerprinted by product type, brand, and site URL in the workspace UI; stale scan results are hidden after those inputs change so operators do not apply candidates from a different context.
- API policy verification now asserts protected test execution keeps admin auth, saved-ready-draft lookup, duplicate-result blocking, and pre-Naver-call ordering in place.
- Blocked staged changes, including Shopping Search channel/product-group preconditions, are now persisted with `approval_required = true` so saved history and audit exports do not understate required operator review.
- Public `/api/health` now returns aggregate environment counts instead of per-secret variable names, reducing configuration fingerprint exposure while keeping admin operational health counts.
- Admin audit events now support server-side group/event-type filtering, so ops-alert views can fetch relevant events directly instead of relying only on client-side filtering of the latest mixed events.
- Performance sync cron heartbeat writes are now best-effort; a heartbeat audit insert failure does not fail an otherwise completed read-only cron run, and the response only exposes whether the heartbeat was recorded.
- Admins now have a read-only report share-link registry that shows active, expired, revoked, and accessed link counts without exposing public tokens or token hashes. Share link creation and revocation also write token-free `ops.report_share.*` audit events on a best-effort basis.
- Performance sync readiness now includes read-only ops backlog visibility: planned/failed cron-eligible counts, blocked/stale-ready counts, oldest cron-eligible plan, latest cron heartbeat, and latest sync alert.
- Live Naver account inventory scans now require Supabase Auth admin access because they use the configured account credentials. Non-admin members can still save planning history but cannot trigger the external account snapshot route.
- Performance stats preview now preserves the requested stats scope in the response and saved sync history, so Shopping Search plan re-runs are no longer recorded as generic Powerlink previews.
- API and performance safety verification now asserts the sensitive share-link and performance-sync invariants: admin share registries cannot query token hashes or rebuild public URLs, public reports must keep raw payload/audit redaction markers, performance previews must preserve scope while avoiding raw stats persistence, and readiness must strip the internal Supabase client before returning JSON.
- Execution drafts can now persist the operator-selected execution context, including campaign, channel, and Shopping Search product-group linkage IDs, so saved history can show which safe connection values were used when the staged payload was prepared. The app remains backward-compatible while the optional `execution_drafts.execution_context` migration is rolling out.
- Planning runs now capture a safe Shopping Search linkage summary (`verified`, `mismatch`, `unverified`, or `not_applicable`) from the staged execution context. Authenticated history and admin activity screens surface that status and CSV exports include the channel/product-group IDs for operator review.
- Shopping Search product-group recommendations generated by the planner are now optionally persisted to `planning_product_groups` and surfaced in authenticated saved-history detail plus limited public reports without exposing raw execution payloads or audit internals.
- If core child-history persistence fails after a planning run parent row is created, the save response now returns the partial planning run id and attempts to write an `ops.planning_save.failed` audit alert, improving recovery visibility without deleting or rolling back production data.
- Planner-generated industry templates, benchmark features, and operating rules can now be persisted on `planning_runs` and shown in saved-history detail/memo exports, preserving the operational rationale behind each saved plan.
- API policy verification now guards those newer history surfaces too: public reports must stay redacted while allowing safe product-group summaries, planning-save failure alerts must remain visible, readiness must list the optional persistence features, and admin ops summaries must cover every `ops.*` event family.
- The admin operational health panel now surfaces Supabase optional feature readiness counts and per-feature status pills, so operators can see whether share links, Shopping Search linkage/product groups, execution context, and planner metadata migrations are installed.

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
