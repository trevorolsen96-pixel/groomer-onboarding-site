-- Lets the app retry a message send safely. The app tags every send with
-- its own client_message_id; /api/messages/send claims that id here
-- *before* texting anyone, so a retry of a send whose response never made
-- it back to the phone (signal dropped mid-request) gets the first
-- attempt's result back instead of texting the client a second time.
--
-- Sends without a client_message_id (older app versions) skip this table
-- entirely and behave exactly as before.
create table if not exists message_send_requests (
  business_id uuid not null references businesses(id) on delete cascade,
  client_message_id text not null,
  -- 'in_progress' while a request is working on it, 'done' once anything
  -- has gone out (or been queued) for it, 'failed' when nothing was sent
  -- and a resend is safe.
  status text not null default 'in_progress'
    check (status in ('in_progress', 'done', 'failed')),
  -- HTTP status + JSON body the first attempt returned, replayed verbatim
  -- to any retry.
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, client_message_id)
);

-- Only ever touched by the send route via the service-role key.
alter table message_send_requests enable row level security;

create index if not exists message_send_requests_created_at_idx
  on message_send_requests (created_at);

-- The same id on the message_items row(s) a send produced, so the app can
-- match its local "sending"/"failed" bubble to the real row when it
-- arrives (and drop the local copy) instead of showing both.
alter table message_items add column if not exists client_message_id text;

create index if not exists message_items_client_message_id_idx
  on message_items (business_id, client_message_id)
  where client_message_id is not null;
