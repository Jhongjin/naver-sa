# Operating Policy

## 1. Principle

The MVP is approval-first.

The system may generate, stage, and recommend changes, but it must not spend money or activate live ads without explicit human approval.

## 2. Automation Levels

### Level 0: Read Only

Allowed:

- account sync
- campaign sync
- ad group sync
- keyword sync
- ad sync
- shopping product group sync
- stats sync
- estimate API calls
- account audit

No user approval required after account connection.

### Level 1: Draft Only

Allowed:

- keyword recommendations
- keyword grouping
- campaign/ad group draft
- ad copy draft
- initial bid suggestions
- budget scenario generation
- negative keyword suggestions
- report drafts

No changes are sent to Naver.

### Level 2: Staged Changes

Allowed:

- prepare campaign creation payloads
- prepare ad group creation payloads
- prepare keyword creation payloads
- prepare ad creative payloads
- prepare Shopping Search campaign/ad group payloads
- prepare pause/off changes
- prepare bid changes

User approval is required before execution.

### Level 3: Test Execution

Allowed only in a test account or explicitly marked test campaign:

- create campaigns
- create ad groups
- create keywords
- create ads
- create Shopping Search test campaigns/ad groups after shopping business channel and product group IDs are resolved
- update bids
- pause/off entities

Restrictions:

- do not activate live campaigns
- do not remove entities
- do not create product groups through the API
- do not exceed configured bid or budget limits

### Level 4: Live Execution

Not allowed in MVP.

Future live execution requires:

- explicit production mode
- role-based permission
- budget guardrails
- bid guardrails
- audit log
- rollback/pause plan
- confirmation step

## 3. Deletion Policy

Deletion is not allowed in MVP.

Instead:

- pause keyword
- pause ad
- pause ad group
- mark as archived in our database

## 4. Spend Safety

Default MVP limits:

- maximum daily campaign budget: 0 KRW unless user sets a test value
- maximum keyword bid: configurable, default 0 KRW until confirmed
- no live activation by default
- no auto-apply recommendations

Before live mode exists, the system should treat all deployments as test or draft workflows.

## 5. Human Approval Requirements

Approval required:

- campaign creation
- ad group creation
- keyword creation
- ad creative creation
- bid change
- budget change
- pause/off action
- negative keyword addition
- campaign activation

No approval required:

- sync
- analysis
- forecast
- draft generation
- report generation

## 6. Change History

Keep all generated and executed changes.

Minimum retention:

- generated drafts: 180 days
- applied mutations: 3 years
- API request logs: 1 year
- prompt logs: 180 days
- user approval records: 3 years

Each executed mutation should store:

- user ID
- workspace ID
- ad account ID
- entity type
- entity ID when available
- before value
- after value
- reason
- approval timestamp
- execution timestamp
- API response status

## 7. AI Policy

AI can recommend and draft.

AI cannot:

- activate live spend
- delete entities
- bypass approval
- hide assumptions in forecasts
- expose secret keys

Every AI output should show:

- source data
- assumptions
- rationale
- confidence
- recommended next action

## 8. MVP Modes

### Agency Mode

Designed for operators managing many accounts.

Default:

- multi-account dashboard
- bulk review
- change queue
- client report

### Advertiser Mode

Designed for simple self-service.

Default:

- guided setup
- simplified forecast
- plain-language rationale
- limited controls

The same backend should support both modes.
