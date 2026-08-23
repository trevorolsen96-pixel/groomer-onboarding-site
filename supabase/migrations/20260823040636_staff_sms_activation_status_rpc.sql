-- business_sms_setup's SELECT RLS is admin-only ("Admins can read own sms
-- setup"), which was invisible until now because only admins ever touched
-- Messages. Now that staff can message clients too, SmsGuardrail.ensureActive
-- (lib/core/helpers/sms_guardrail.dart) runs the same pre-send activation
-- check for staff senders -- and since it reads business_sms_setup directly
-- via the RLS-scoped client, that read comes back empty for staff, wrongly
-- showing "SMS Not Activated" even when it genuinely is.
--
-- Rather than broadening RLS on the whole table (it also holds 10DLC
-- carrier-registration payloads/telnyx internal ids that staff shouldn't
-- see), expose just the 3 fields the activation check actually needs via a
-- narrow RPC any business member (not just admin) can call.
create or replace function get_sms_activation_status_for_business(p_business_id uuid)
returns table (
  status text,
  phone_number text,
  care_reminder_send_time_local time
)
language sql
security definer
set search_path = public
as $$
  select s.status, s.phone_number, s.care_reminder_send_time_local
  from business_sms_setup s
  where s.business_id = p_business_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.business_id = p_business_id
    );
$$;
