# Naver Execution Draft

Date: 2026-05-03

## Scope

Added a payload preview layer that converts approved staged changes into Naver Search Ad mutation drafts.

Implemented:

- campaign creation payload draft
- ad group creation payload draft
- keyword bulk creation payload draft
- ad copy creation payload draft
- JSON export from the UI
- live execution and delete execution safety flags

## Safety

- The draft is not sent to Naver.
- Payloads are generated only from changes marked `approved` in the local approval queue.
- Live activation remains blocked.
- Delete payloads are not generated.
- Placeholder IDs are used where real Naver IDs must be resolved by a future test execution worker.

## Remaining Work

Before actual test account execution:

- resolve real channel IDs and ad group IDs
- create execution audit events before and after every API call
- require authenticated role-based approval
- enforce budget and bid caps server-side
