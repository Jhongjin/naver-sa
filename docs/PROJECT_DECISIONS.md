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

- Implemented: membership auth, signup confirmation resend, admin email confirmation fallback, my page session/retry status, admin user management with user/activity filters, setup planner, keyword/search-query expansion/classification, ad group draft, bid/budget guardrails, approval queue, CSV/Excel/Markdown/PDF-ready report exports, dry-run optimization recommendations, Naver execution payload preview, protected test execution route, Naver API readiness layer, admin read-only Naver campaign check, Shopping Search product-group scan, Supabase planning/audit/execution history schema, URL-synced searchable saved history browser, execution draft detail with payload inspection, saved draft success summaries, and no-store protected API response policy with a local lint check.
- Partial: real performance sync, live bidding automation, and multi-account role separation beyond the current workspace membership model.
- Planned: scheduled Naver account sync, performance-based bidding recommendations, share-link reports, deeper execution audit analytics, and production live-mode approval workflow.

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
