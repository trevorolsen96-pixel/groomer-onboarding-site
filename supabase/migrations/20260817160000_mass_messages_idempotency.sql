-- Lets the mass-send API recognize a retried request instead of sending
-- every customer the same blast twice. The client generates one UUID per
-- user-initiated send and this column makes that unique per business, so
-- a retry (network timeout, proxy resend, etc.) can be detected and
-- short-circuited before any SMS gets queued a second time.
alter table mass_messages
  add column client_request_id text;

create unique index mass_messages_business_client_request_id_key
  on mass_messages (business_id, client_request_id)
  where client_request_id is not null;
