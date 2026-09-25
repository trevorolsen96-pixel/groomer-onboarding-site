-- Retires the "assign a client to one groomer" system for messaging and
-- scheduling. Manually assigning every client to a specific groomer (or
-- "All Staff") turned out to be tedious busywork for the business owner,
-- and it didn't actually track who a groomer has real history with. New
-- rule instead:
--   * Messaging: a staff member can message a client iff they have a
--     non-cancelled appointment (past OR future) with that specific
--     client. Automatic, no manual assignment needed.
--   * Scheduling: opened up entirely -- any active staff member with
--     can_create_appointments can book any active client. There's no
--     more "assigned" concept to restrict it by.
-- customers.assigned_worker_id / customers.messaging_access are left in
-- place (still populated with whatever a row already had) but are no
-- longer consulted by either RPC below -- harmless, unused columns
-- rather than a destructive drop.

create or replace function staff_can_message_customer(
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
      and exists (
        select 1 from appointments a
        where a.customer_id = c.id
          and a.worker_id = w.id
          and a.status <> 'cancelled'
      )
  );
$$;

-- get_staff_messageable_clients: same tri-state-free client-search RPC,
-- now driven by "has an appointment with me" instead of an assignment
-- field. Still never exposes phone/email to the caller.
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
  select distinct c.id, c.name, c.image_url, c.assigned_worker_id
  from customers c
  join workers w on w.business_id = c.business_id
  join appointments a on a.customer_id = c.id and a.worker_id = w.id
  where c.business_id = p_business_id
    and w.profile_id = auth.uid()
    and w.business_id = p_business_id
    and w.active = true
    and w.can_message_clients = true
    and c.deleted = false
    and a.status <> 'cancelled'
  order by c.name;
$$;

-- get_staff_schedulable_clients: no more restriction by assignment --
-- any active, scheduling-enabled staff member can book any active client.
create or replace function get_staff_schedulable_clients(p_business_id uuid)
returns table (
  id uuid,
  name text,
  image_url text,
  address text,
  assigned_worker_id uuid
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.image_url, c.address, c.assigned_worker_id
  from customers c
  join workers w on w.business_id = c.business_id
  where c.business_id = p_business_id
    and w.profile_id = auth.uid()
    and w.business_id = p_business_id
    and w.active = true
    and w.can_create_appointments = true
    and c.deleted = false
    and c.is_active = true
  order by c.name;
$$;
