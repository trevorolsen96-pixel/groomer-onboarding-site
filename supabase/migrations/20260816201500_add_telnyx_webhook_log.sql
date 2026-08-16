-- Unconditional, dependency-free log of every hit to the Telnyx inbound
-- webhooks (SMS + voice), written as the very first action before any
-- business/customer matching, signature checking, or anything else that
-- could fail. Existing logging (sms_events) requires a resolved
-- business_id, so any failure before that point left zero trace anywhere
-- queryable -- during a live incident, that meant genuinely not knowing
-- whether Telnyx had even called the webhook at all. This table has no
-- required fields beyond id/created_at, so a row lands here no matter
-- what happens afterward.
--
-- Service-role only (matches message_attachment_links) -- this is an
-- internal debugging log, not something the app needs to read.
create table telnyx_webhook_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  from_phone text,
  to_phone text,
  body text,
  signature_result text,
  raw_headers jsonb
);

alter table telnyx_webhook_log enable row level security;
revoke insert, select, update, delete on telnyx_webhook_log from anon, authenticated;

-- Old rows have no business/support value after a few days -- keep this
-- from growing unbounded. (One-time cleanup; ongoing pruning can be added
-- later if needed.)
create index telnyx_webhook_log_created_at_idx on telnyx_webhook_log (created_at);
