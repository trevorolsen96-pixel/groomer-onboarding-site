-- Lets a message thread exist without a real client record. Previously
-- every inbound text from an unrecognized number auto-created a full
-- `customers` row just so a conversation could reference it (customer_id
-- was NOT NULL) -- which meant wrong numbers, spam, and one-off inquiries
-- permanently cluttered the real Clients list. Now those threads can have
-- customer_id = NULL and are labeled by phone number only; nothing is
-- added to Clients unless the business explicitly saves them as a client.
alter table message_conversations alter column customer_id drop not null;
alter table message_items alter column customer_id drop not null;
