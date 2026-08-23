-- vehicles' only existing policy is admin-only ("admins manage vehicles",
-- ALL). Staff had no reason to read this table before (no
-- vehicle-selecting feature reached them), so this was invisible -- now
-- that staff can create their own appointments, the app tries to
-- auto-assign their worker's default_vehicle_id, which silently no-ops
-- because the vehicle list it checks against is always empty for a staff
-- session. Vehicle names ("Van 2") aren't sensitive -- add the same
-- business-wide SELECT policy every other lookup table (workers,
-- customers) already has.
create policy "business read vehicles" on vehicles
  for select using (
    business_id in (
      select profiles.business_id from profiles where profiles.id = auth.uid()
    )
  );
