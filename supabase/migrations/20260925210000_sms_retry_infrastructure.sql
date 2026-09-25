-- Infrastructure for automatic SMS retry (both the appointment-reminder
-- queue and direct staff/admin sends) plus inbound-webhook idempotency.
--
-- message_item_id links a sms_outbound_queue row back to the
-- message_items bubble it's retrying on behalf of -- only set for
-- message_type = 'direct_message' rows (a staff/admin send that failed
-- transiently on its first synchronous attempt and got queued for
-- background retry). Reminder-type rows leave this null, same as today,
-- since they don't have a pre-existing bubble to update.
alter table sms_outbound_queue
  add column if not exists message_item_id uuid references message_items(id) on delete cascade;

-- provider_message_id lets the inbound webhook dedupe: Telnyx retries
-- webhook delivery on its own schedule when we tell it we failed (see
-- the inbound route changes), so the same inbound text could arrive
-- twice. Storing the provider's own message id and enforcing uniqueness
-- per business means a legitimate retry just no-ops instead of creating
-- a duplicate message.
alter table message_items
  add column if not exists provider_message_id text;

create unique index if not exists message_items_provider_message_id_uniq
  on message_items (business_id, provider_message_id)
  where provider_message_id is not null;
