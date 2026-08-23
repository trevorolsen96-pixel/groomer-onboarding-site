-- Staff scheduling their own appointments should only be able to pick a
-- client assigned to them (or unassigned / "All") -- same boundary as
-- messaging, gated on the separate can_create_appointments permission
-- instead of can_message_clients (a worker can have either, both, or
-- neither). And, same as get_staff_messageable_clients, this must never
-- expose a phone number to the app for this surface -- the client picker
-- currently reads the full customers list (which does include phone) via
-- ScheduleController.activeCustomers; this RPC gives the appointment
-- editor a phone-free, assignment-scoped alternative for staff.
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
    and (c.assigned_worker_id is null or c.assigned_worker_id = w.id)
  order by c.name;
$$;
