-- Messaging access is now a 3-way choice per client, not just "All Staff"
-- vs "one specific groomer":
--   'unassigned' (new default) -- no staff member can message this client
--     at all, regardless of their can_message_clients permission. Admin-only.
--   'all'        -- any messaging-enabled staff member can message them.
--   'assigned'   -- only the one worker in assigned_worker_id can.
-- Defaulting every row (existing and new) to 'unassigned' is a deliberate
-- safety-first change: an admin now has to explicitly open a client up to
-- staff messaging rather than it being implicitly on.
alter table customers add column messaging_access text not null default 'unassigned'
  check (messaging_access in ('unassigned', 'all', 'assigned'));

-- Drop the 4 policies that depend on staff_can_message_customer's current
-- signature first -- its parameter is being renamed (assigned_worker_id ->
-- customer_id), and Postgres won't let CREATE OR REPLACE FUNCTION rename a
-- parameter, only DROP + CREATE, which in turn requires no live dependents.
drop policy if exists "read own business message conversations" on message_conversations;
drop policy if exists "insert own business message conversations" on message_conversations;
drop policy if exists "update own business message conversations" on message_conversations;
drop policy if exists "read own business message items" on message_items;

drop function if exists staff_can_message_customer(uuid, uuid);

-- staff_can_message_customer now looks up the customer's row directly
-- (previously took a pre-fetched assigned_worker_id, which had no way to
-- express "unassigned/admin-only" distinctly from "All"). Callers now pass
-- customer_id instead.
create function staff_can_message_customer(
  p_business_id uuid,
  p_customer_id uuid
) returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from workers w
    join customers c on c.id = p_customer_id
    where w.profile_id = auth.uid()
      and w.business_id = p_business_id
      and c.business_id = p_business_id
      and w.active = true
      and w.can_message_clients = true
      and c.messaging_access <> 'unassigned'
      and (
        c.messaging_access = 'all'
        or (c.messaging_access = 'assigned' and c.assigned_worker_id = w.id)
      )
  );
$$;

create policy "read own business message conversations" on message_conversations
  for select using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          message_conversations.customer_id
        )
      )
    )
  );

create policy "insert own business message conversations" on message_conversations
  for insert with check (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          message_conversations.customer_id
        )
      )
    )
  );

create policy "update own business message conversations" on message_conversations
  for update using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          message_conversations.customer_id
        )
      )
    )
  ) with check (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          message_conversations.customer_id
        )
      )
    )
  );

create policy "read own business message items" on message_items
  for select using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or exists (
        select 1 from message_conversations mc
        where mc.id = message_items.conversation_id
          and mc.customer_id is not null
          and staff_can_message_customer(mc.business_id, mc.customer_id)
      )
    )
  );

-- get_staff_messageable_clients: same tri-state check for the staff
-- client-search RPC.
create or replace function get_staff_messageable_clients(p_business_id uuid)
returns table (
  id uuid,
  name text,
  image_url text,
  assigned_worker_id uuid
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.image_url, c.assigned_worker_id
  from customers c
  join workers w on w.business_id = c.business_id
  where c.business_id = p_business_id
    and w.profile_id = auth.uid()
    and w.business_id = p_business_id
    and w.active = true
    and w.can_message_clients = true
    and c.deleted = false
    and c.messaging_access <> 'unassigned'
    and (
      c.messaging_access = 'all'
      or (c.messaging_access = 'assigned' and c.assigned_worker_id = w.id)
    )
  order by c.name;
$$;
