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
2. Shopping mall vertical first
3. Other verticals later

First sample site:

- `https://mard.at/`

Excluded from first build:

- Brand Search full automation
- Place Ads full automation
- Shopping Search full automation

Shopping mall support in MVP means the first vertical/playbook is ecommerce-oriented Powerlink/Site Search Ads. Shopping Search Ads can become a later dedicated module.

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

- Implemented: setup planner, keyword expansion/classification, ad group draft, bid/budget guardrails, approval queue, CSV/Markdown export, Naver API readiness layer.
- Partial: operation automation recommendations.
- Planned: Naver account sync, performance-based bidding recommendations, persisted audit log, PDF/share-link reports, test-account execution worker.

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
