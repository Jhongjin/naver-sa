-- Allow the same safe Naver idempotency key to appear in multiple saved draft histories.
-- Payload rows remain unique within a draft by (execution_draft_id, payload_key).

alter table public.execution_payloads
  drop constraint if exists execution_payloads_idempotency_key_key;

create index if not exists execution_payloads_idempotency_idx
  on public.execution_payloads(idempotency_key);
