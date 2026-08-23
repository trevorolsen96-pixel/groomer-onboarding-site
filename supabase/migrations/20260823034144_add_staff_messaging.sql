-- Staff messaging: lets staff/groomers text their own assigned clients from
-- the business's shared number, gated by a per-staff permission toggle and
-- scoped to clients assigned to them (or unassigned / "All"), with every
-- staff-sent message attributed and visible in the admin's full thread.
--
-- New columns:
--   workers.can_message_clients   -- per-staff permission toggle
--   customers.assigned_worker_id  -- null = "All" (every allowed staff member)
--   message_items.sent_by_worker_id -- attribution on outbound messages

alter table workers add column can_message_clients boolean not null default false;
alter table customers add column assigned_worker_id uuid references workers(id) on delete set null;
alter table message_items add column sent_by_worker_id uuid references workers(id) on delete set null;

create index if not exists customers_assigned_worker_id_idx on customers(assigned_worker_id);
create index if not exists message_items_sent_by_worker_id_idx on message_items(sent_by_worker_id);

-- Does the caller (auth.uid()) have an active, messaging-enabled worker row
-- for [p_business_id], and is [p_assigned_worker_id] either unassigned
-- ("All") or specifically them? Shared by every staff-scoped policy below.
create or replace function staff_can_message_customer(
  p_business_id uuid,
  p_assigned_worker_id uuid
) returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from workers w
    where w.profile_id = auth.uid()
      and w.business_id = p_business_id
      and w.active = true
      and w.can_message_clients = true
      and (p_assigned_worker_id is null or p_assigned_worker_id = w.id)
  );
$$;

-- message_conversations -------------------------------------------------
-- Today these 4 policies are business_id-scoped only, with zero role
-- distinction -- any authenticated business member (admin or staff) can
-- already read/insert/update every conversation in the business directly
-- via the Supabase client (bypassing the app's own UI restrictions).
-- Replace with role-aware versions: admins keep unrestricted business
-- access; staff are additionally scoped to their assigned/unassigned
-- customers, gated on their own can_message_clients toggle. Conversations
-- with no matched customer (unrecognized number) become admin-only, since
-- "assignment" has no meaning there.

drop policy if exists "read own business message conversations" on message_conversations;
create policy "read own business message conversations" on message_conversations
  for select using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          (select c.assigned_worker_id from customers c where c.id = message_conversations.customer_id)
        )
      )
    )
  );

drop policy if exists "insert own business message conversations" on message_conversations;
create policy "insert own business message conversations" on message_conversations
  for insert with check (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          (select c.assigned_worker_id from customers c where c.id = message_conversations.customer_id)
        )
      )
    )
  );

drop policy if exists "update own business message conversations" on message_conversations;
create policy "update own business message conversations" on message_conversations
  for update using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or (
        message_conversations.customer_id is not null
        and staff_can_message_customer(
          message_conversations.business_id,
          (select c.assigned_worker_id from customers c where c.id = message_conversations.customer_id)
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
          (select c.assigned_worker_id from customers c where c.id = message_conversations.customer_id)
        )
      )
    )
  );

-- DELETE stays admin-only -- the app only ever soft-deletes conversations
-- via UPDATE (deleted = true); a hard DELETE is never issued by the client.
drop policy if exists "delete own business message conversations" on message_conversations;
create policy "delete own business message conversations" on message_conversations
  for delete using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.business_id = message_conversations.business_id
        and p.role = 'admin'
    )
  );

-- message_items -----------------------------------------------------------
-- SELECT gets the same staff scoping, joined through conversation_id
-- (customer_id on message_items is a nullable convenience copy, not
-- authoritative). INSERT/UPDATE/DELETE are tightened to admin-only --
-- confirmed the Flutter app never writes to this table directly; every
-- real send goes through the service-role-backed API route
-- (app/api/messages/send/route.ts, bypasses RLS entirely), which is where
-- the actual per-staff send permission + sent_by_worker_id attribution is
-- enforced.

drop policy if exists "read own business message items" on message_items;
create policy "read own business message items" on message_items
  for select using (
    business_id = (select p.business_id from profiles p where p.id = auth.uid())
    and (
      (select p.role from profiles p where p.id = auth.uid()) = 'admin'
      or exists (
        select 1 from message_conversations mc
        where mc.id = message_items.conversation_id
          and mc.customer_id is not null
          and staff_can_message_customer(
            mc.business_id,
            (select c.assigned_worker_id from customers c where c.id = mc.customer_id)
          )
      )
    )
  );

drop policy if exists "insert own business message items" on message_items;
create policy "insert own business message items" on message_items
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.business_id = message_items.business_id
        and p.role = 'admin'
    )
  );

drop policy if exists "update own business message items" on message_items;
create policy "update own business message items" on message_items
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.business_id = message_items.business_id
        and p.role = 'admin'
    )
  );

drop policy if exists "delete own business message items" on message_items;
create policy "delete own business message items" on message_items
  for delete using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.business_id = message_items.business_id
        and p.role = 'admin'
    )
  );

-- Server-side, phone-number-safe client list for the staff messaging
-- surface: returns only what's needed to search/select a client to
-- message -- never phone/email/address/notes -- pre-filtered to clients
-- assigned to the caller (or unassigned / "All"). customers RLS itself is
-- intentionally left untouched (staff already need full customer read
-- access for the existing appointment/schedule board flows); this RPC is
-- the actual phone-number guarantee for the messaging surface specifically.
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
    and (c.assigned_worker_id is null or c.assigned_worker_id = w.id)
  order by c.name;
$$;
