-- Staff couldn't actually edit an appointment's pricing: appointments
-- itself already has a worker UPDATE policy ("workers update status on
-- assigned appointments") broad enough to cover total_price/
-- discount_percent too, but appointment_pet_services -- where each
-- service line's price actually lives -- only ever had INSERT and
-- SELECT policies for workers, plus an admin-only ALL policy. A staff
-- member's price edit in the app's pricing sheet would silently no-op
-- (0 rows updated, no error surfaced) since RLS blocked the UPDATE, and
-- the recalculated total_price would just reflect the unchanged prices.
-- Mirrors the same worker-owns-the-appointment + can_create_appointments
-- gate the existing INSERT policy already uses.
create policy "workers with scheduling update own appointment pet services"
on appointment_pet_services
for update
using (
  exists (
    select 1 from appointments a
    join workers w on w.id = a.worker_id
    where a.id = appointment_pet_services.appointment_id
      and w.profile_id = auth.uid()
      and w.active = true
      and w.can_create_appointments = true
  )
)
with check (
  exists (
    select 1 from appointments a
    join workers w on w.id = a.worker_id
    where a.id = appointment_pet_services.appointment_id
      and w.profile_id = auth.uid()
      and w.active = true
      and w.can_create_appointments = true
  )
);

-- The pricing sheet also lets a groomer remove a service line entirely
-- (the delete icon) -- same gate, needed so that action doesn't silently
-- no-op the same way the price edit did.
create policy "workers with scheduling delete own appointment pet services"
on appointment_pet_services
for delete
using (
  exists (
    select 1 from appointments a
    join workers w on w.id = a.worker_id
    where a.id = appointment_pet_services.appointment_id
      and w.profile_id = auth.uid()
      and w.active = true
      and w.can_create_appointments = true
  )
);
