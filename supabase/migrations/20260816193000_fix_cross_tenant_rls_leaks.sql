-- Security audit fix: several tables had RLS policies that never actually
-- scoped access by business_id (some were literally "qual: true", one was
-- a tautological self-join that's always true regardless of caller). Any
-- authenticated user of ANY business (or, for a couple of these, literally
-- anyone unauthenticated) could read/write another business's data via the
-- Supabase REST API directly, bypassing the app entirely.
--
-- Every table fixed here already has its app-side queries explicitly
-- filtered by business_id (confirmed by reading the Flutter/Next.js call
-- sites before writing this migration), so this migration is pure
-- defense-in-depth tightening -- it should not change any legitimate
-- in-app behavior, only close off direct-API abuse.

-- ─── message_conversations / message_items ──────────────────────────────
-- Were: qual "true" for every command, no business_id check at all.

drop policy if exists "Allow authenticated users to read message conversations" on message_conversations;
drop policy if exists "Allow authenticated users to insert message conversations" on message_conversations;
drop policy if exists "Allow authenticated users to update message conversations" on message_conversations;
drop policy if exists "Allow authenticated users to delete message conversations" on message_conversations;

create policy "read own business message conversations" on message_conversations
  for select using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "insert own business message conversations" on message_conversations
  for insert with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "update own business message conversations" on message_conversations
  for update using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "delete own business message conversations" on message_conversations
  for delete using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Allow authenticated users to read message items" on message_items;
drop policy if exists "Allow authenticated users to insert message items" on message_items;
drop policy if exists "Allow authenticated users to update message items" on message_items;
drop policy if exists "Allow authenticated users to delete message items" on message_items;

create policy "read own business message items" on message_items
  for select using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "insert own business message items" on message_items
  for insert with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "update own business message items" on message_items
  for update using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "delete own business message items" on message_items
  for delete using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

-- ─── booking_requests ────────────────────────────────────────────────────
-- Was: "business_id IN (SELECT businesses.id FROM businesses WHERE
-- businesses.id = booking_requests.business_id)" -- a tautology, always
-- true, granted to role `public` (includes unauthenticated anon). Every
-- server-side write to this table already goes through the service-role
-- client (app/api/book/request, app/api/book/notify), so public/anon never
-- legitimately needs direct access to it at all.

drop policy if exists "Business can manage their booking requests" on booking_requests;

create policy "manage own business booking requests" on booking_requests
  for all using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

-- ─── message_attachment_links ────────────────────────────────────────────
-- Was: RLS disabled entirely, with default anon+authenticated grants --
-- anyone with the public anon key could read/insert/update/delete this
-- table directly, which maps short wagzly.com/p/<id> links to private
-- photo storage paths (app/p/[id]/route.ts resolves it with the
-- service-role client and 302-redirects to a signed URL). This table is
-- only ever touched server-side by that route and by the send/attachment
-- endpoints, all via supabaseAdmin (service role, which bypasses RLS) --
-- there's no legitimate reason for anon/authenticated to touch it at all.

alter table message_attachment_links enable row level security;
revoke insert, select, update, delete on message_attachment_links from anon, authenticated;

-- ─── onboarding_question_responses ───────────────────────────────────────
-- SELECT policies only checked that a matching customer_id/pet_id row
-- existed anywhere, not that it belonged to the caller's business -- any
-- authenticated user could read any other business's intake answers
-- (frequently medical/behavioral info). The INSERT policies were already
-- correctly scoped through profiles.business_id and are untouched here.

drop policy if exists "Authenticated users can read customer onboarding responses" on onboarding_question_responses;
drop policy if exists "Authenticated users can read pet onboarding responses" on onboarding_question_responses;

create policy "read own business customer onboarding responses" on onboarding_question_responses
  for select using (
    customer_id in (
      select customers.id from customers
      where customers.business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
    )
  );

create policy "read own business pet onboarding responses" on onboarding_question_responses
  for select using (
    pet_id in (
      select pets.id from pets
      where pets.business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
    )
  );

-- ─── onboarding_questions / service_groups ───────────────────────────────
-- Were: qual/with_check "true" for every command -- any authenticated user
-- of any business could read/edit/delete another business's custom intake
-- questions or service groupings.

drop policy if exists "Allow select for business users" on onboarding_questions;
drop policy if exists "Allow insert for business users" on onboarding_questions;
drop policy if exists "Allow update for business users" on onboarding_questions;
drop policy if exists "Allow delete for business users" on onboarding_questions;

create policy "read own business onboarding questions" on onboarding_questions
  for select using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "insert own business onboarding questions" on onboarding_questions
  for insert with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "update own business onboarding questions" on onboarding_questions
  for update using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );
create policy "delete own business onboarding questions" on onboarding_questions
  for delete using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Authenticated users can manage service groups" on service_groups;

create policy "manage own business service groups" on service_groups
  for all using (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id = (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

-- ─── staff_invites ────────────────────────────────────────────────────────
-- INSERT policy had with_check "true" -- any authenticated staff member
-- (not just admins) could insert an invite row for ANY worker slot in
-- their own business, including an admin-flagged one, then accept it
-- themselves via /api/staff-invite/[token] (which derives the new
-- profile's role from workers.is_admin) -- a worker-to-admin privilege
-- escalation within the same business. This was the only policy on the
-- table (confirmed via pg_policies), so nothing else here is touched.

drop policy if exists "Authenticated users can create staff invites" on staff_invites;

create policy "admins create own business staff invites" on staff_invites
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.business_id = staff_invites.business_id
        and p.role = 'admin'
    )
    and exists (
      select 1 from workers w
      where w.id = staff_invites.worker_id
        and w.business_id = staff_invites.business_id
    )
  );
