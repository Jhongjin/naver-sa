# Staged Draft Validation

> Superseded on 2026-05-16: browser-facing protected workflows now use Supabase Auth sessions instead of `OPERATOR_ACCESS_CODE`. This note remains historical implementation context only.

Date: 2026-05-03

## Scope

Added a browser-safe dry-run route and UI flow for approved Naver Search Ad setup drafts.

Route:

- `POST /api/naver/stage-draft`

The route:

- regenerates the planner plan server-side
- applies the submitted approval decisions
- accepts optional execution context such as Naver channel IDs
- creates a Naver execution draft
- validates the payloads
- returns blockers and warnings
- does not call Naver
- does not mutate Supabase

## UI Flow

The planner UI now supports:

- approve all staged changes
- reset approval decisions
- enter an operator access code
- scan Naver account inventory when `OPERATOR_ACCESS_CODE` is configured
- apply a business channel ID to PC and mobile channel fields
- validate the approved draft from the browser
- show draft ID, blocker count, warnings, and payload summaries

## Safety

The browser route is dry-run only.

The browser dry-run route:

- rejects cross-origin requests
- uses `OPERATOR_ACCESS_CODE` when configured
- remains mutation-free even when open-dry-run mode is active

Read-only account inventory is isolated in:

- `GET /api/naver/account-snapshot`

That route requires `OPERATOR_ACCESS_CODE` and only reads business channels and campaign summaries.

Protected mutation remains isolated in:

- `POST /api/naver/execute-draft`

That route now rejects execution when draft validation has unresolved blockers.

Current blockers include:

- no approved payloads
- unresolved placeholder Naver IDs
- missing Naver business channel IDs
- unsafe methods
- missing safety flags
- `userLock: false`

Warnings include:

- daily budgets above the MVP test review threshold

## Remaining Work

Before protected test execution:

- configure `OPERATOR_ACCESS_CODE` in Vercel
- confirm a Naver business channel exists for the test website
- store execution audit events
- add a final one-click protected test execution control after explicit action-time confirmation
