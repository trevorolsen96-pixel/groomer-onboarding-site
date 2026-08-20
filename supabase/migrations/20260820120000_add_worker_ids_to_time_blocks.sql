-- Time blocks were entirely business-wide, with no concept of which
-- groomer they apply to -- a problem once a business has more than one
-- groomer, since one groomer's vacation or lunch shouldn't grey out
-- everyone else's calendar too. Time blocks can apply to multiple
-- groomers at once (e.g. a shared lunch slot), so this is an array
-- column rather than a single foreign key.
--
-- Full-day/holiday closures are handled separately by business_holidays
-- and are unaffected by this -- this is only about the groomer-specific
-- lunch/vacation/personal-time use case.
alter table public.business_time_blocks
  add column if not exists worker_ids uuid[] not null default '{}'::uuid[];

-- Backfill: every existing time block currently affects every groomer
-- (there was no filtering at all before this column existed). Preserve
-- that exact behavior for existing rows rather than having them silently
-- stop applying to anyone once the app starts filtering by worker_ids.
update public.business_time_blocks btb
set worker_ids = (
  select coalesce(array_agg(w.id), '{}'::uuid[])
  from public.workers w
  where w.business_id = btb.business_id
)
where worker_ids = '{}'::uuid[];
