# Staged Draft Validation

Date: 2026-05-03

## Scope

Added a browser-safe dry-run route and UI flow for approved Naver Search Ad setup drafts.

Route:

- `POST /api/naver/stage-draft`

The route:

- regenerates the planner plan server-side
- applies the submitted approval decisions
- creates a Naver execution draft
- validates the payloads
- returns blockers and warnings
- does not call Naver
- does not mutate Supabase

## UI Flow

The planner UI now supports:

- approve all staged changes
- reset approval decisions
- validate the approved draft from the browser
- show draft ID, blocker count, warnings, and payload summaries

## Safety

The browser route is dry-run only.

Protected mutation remains isolated in:

- `POST /api/naver/execute-draft`

That route now rejects execution when draft validation has unresolved blockers.

Current blockers include:

- no approved payloads
- unresolved placeholder Naver IDs
- unsafe methods
- missing safety flags
- `userLock: false`

Warnings include:

- daily budgets above the MVP test review threshold

## Remaining Work

Before protected test execution:

- resolve real Naver channel IDs
- resolve created ad group IDs for keyword/ad payloads
- store execution audit events
- expose account/channel selection in the operator UI
