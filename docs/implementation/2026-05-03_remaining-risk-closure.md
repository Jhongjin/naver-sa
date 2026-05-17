# Remaining Risk Closure

> Superseded on 2026-05-16 and 2026-05-17: browser-facing protected workflows now use Supabase Auth sessions instead of `OPERATOR_ACCESS_CODE`, and protected test execution uses Supabase Auth admin access instead of shared admin secrets. This note remains historical implementation context only.

Date: 2026-05-03

## Closed In This Pass

### Public dry-run surface

Added operator access handling:

- `POST /api/naver/stage-draft` rejects cross-origin requests.
- If `OPERATOR_ACCESS_CODE` is configured, browser dry-run staging requires `x-operator-code`.
- If `OPERATOR_ACCESS_CODE` is not configured, the route remains open-dry-run but still does not call Naver or mutate data.

Added protected account inventory:

- `GET /api/naver/account-snapshot`
- requires `OPERATOR_ACCESS_CODE`
- performs read-only Naver calls for business channels and campaign summaries

### Placeholder Naver IDs

Execution drafts now accept execution context:

- `pcChannelId`
- `mobileChannelId`
- optional existing `campaignId`
- optional existing `adgroupIdsByName`

Drafts now use runtime references for IDs that can be created earlier in the same protected execution:

- campaign creation returns `nccCampaignId`
- ad group creation returns `nccAdgroupId`
- keyword/ad payloads reference the matching ad group runtime ID

Missing business channel IDs remain a blocker because they must exist before ad group creation.

### Protected test execution

`POST /api/naver/execute-draft` now resolves runtime references between approved payloads before each Naver request.

The route still requires:

- authenticated Supabase Auth admin session
- saved ready execution draft history
- no previously recorded execution results for the draft
- `execute: true`
- `confirmation: "TEST_EXECUTION_ONLY"`
- zero validation blockers

## User Actions Needed

1. Configure `OPERATOR_ACCESS_CODE` in Vercel Production and Preview.
2. Redeploy after adding the environment variable.
3. In the app, enter the operator code and run account scan.
4. If no site business channel appears, create or approve a Naver Search Ad business channel for the test website.
5. Apply the business channel ID to PC/mobile channel fields.

## Still Deliberately Blocked

Actual protected Naver mutation is still not exposed in the browser UI.

Before adding it:

- confirm the business channel is correct
- confirm test-only account scope
- add execution audit persistence
- ask for action-time confirmation immediately before the first mutation
