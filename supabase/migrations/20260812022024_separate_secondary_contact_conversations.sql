-- Messaging a customer's secondary contact previously shared the same
-- message_conversations row as the primary contact (only the outbound
-- SMS destination differed, via a client-side override). That merged
-- both people's message history into one thread. This adds a proper
-- second thread per customer for their secondary contact.

alter table message_conversations
  add column contact_type text not null default 'primary'
  check (contact_type in ('primary', 'secondary'));

-- At most one conversation per (customer, contact_type) — mirrors the
-- one-conversation-per-customer assumption the app already relied on,
-- just scoped per contact now.
create unique index message_conversations_customer_contact_type_idx
  on message_conversations (business_id, customer_id, contact_type);
