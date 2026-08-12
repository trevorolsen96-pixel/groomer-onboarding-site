-- The existing RLS policies on onboarding_question_responses only ever
-- considered pet_id, from before client-level (customer_id-scoped)
-- answers existed. Effect: client-level rows (pet_id null, customer_id
-- set) were invisible to the app's authenticated reads, and blocked
-- outright when the Flutter app tries to insert them during booking/
-- onboarding approval. Postgres OR's multiple permissive policies
-- together, so these are additive — the existing pet_id-based policies
-- are untouched.

-- Mirrors the existing pet-based SELECT policy's looseness (existence
-- check only, no business scoping) for consistency with current
-- behavior rather than silently tightening security as a side effect.
create policy "Authenticated users can read customer onboarding responses"
on onboarding_question_responses
for select
to authenticated
using (
  exists (
    select 1 from customers c
    where c.id = onboarding_question_responses.customer_id
  )
);

-- Mirrors the existing pet-based INSERT policy's business-ownership check.
create policy "Business owner can insert customer question responses"
on onboarding_question_responses
for insert
with check (
  customer_id in (
    select customers.id from customers
    where customers.business_id in (
      select profiles.business_id from profiles where profiles.id = auth.uid()
    )
  )
);
