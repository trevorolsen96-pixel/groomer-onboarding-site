-- Lets a groomer delete a message thread from the app. Soft-delete,
-- mirroring the existing customers.deleted/pets.deleted pattern, rather
-- than a hard delete -- keeps message_items (and any support/audit trail)
-- intact instead of needing a manual cascade-delete, and is reversible if
-- someone deletes the wrong thread.
alter table message_conversations
  add column deleted boolean not null default false;
