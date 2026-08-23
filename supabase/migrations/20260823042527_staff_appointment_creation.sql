-- Lets staff/groomers create appointments for themselves (never another
-- groomer), gated by a new per-staff permission toggle, same pattern as
-- can_message_clients added earlier. Unlike message_conversations, the
-- appointments/appointment_pet_services tables currently have ZERO insert
-- policy for non-admin roles at all -- staff can already SELECT their own
-- assigned appointments and UPDATE status on them, but creating a new one
-- is fully blocked today. These policies are additive/narrow: a staff
-- member can only insert a row that is already assigned to their own
-- worker id, and only if their own can_create_appointments flag is on.

alter table workers add column can_create_appointments boolean not null default false;

create policy "workers with scheduling create own appointments" on appointments
  for insert with check (
    exists (
      select 1 from workers w
      where w.profile_id = auth.uid()
        and w.business_id = appointments.business_id
        and w.id = appointments.worker_id
        and w.active = true
        and w.can_create_appointments = true
    )
  );

create policy "workers with scheduling create own appointment pet services" on appointment_pet_services
  for insert with check (
    exists (
      select 1 from appointments a
      join workers w on w.id = a.worker_id
      where a.id = appointment_pet_services.appointment_id
        and w.profile_id = auth.uid()
        and w.active = true
        and w.can_create_appointments = true
    )
  );
