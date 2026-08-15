-- Pet birthday: when known, this becomes the source of truth for age
-- (computed live in the app), rather than the free-text `age` column,
-- which stays as-is for pets whose exact birthdate isn't known.
alter table pets
  add column birthday date;

-- Client "joined on" date. Deliberately separate from `created_at`:
-- created_at is the row-insert time, which for onboarding/booking-request
-- -originated clients is whenever a groomer got around to approving the
-- submission -- not when the client actually first reached out. joined_at
-- is set explicitly, once, at each creation path using the correct source
-- timestamp (see app code), so it accurately reflects "how long has this
-- been a client."
alter table customers
  add column joined_at timestamptz;

-- Backfill existing rows with created_at -- the best available estimate
-- for clients that already exist, since there's no earlier submission
-- timestamp to recover for them.
update customers
  set joined_at = created_at
  where joined_at is null;
