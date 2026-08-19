-- Tracks whether a business's Telnyx number has actually been linked to the
-- 10DLC campaign (a separate step from purchasing the number and assigning
-- it to a messaging profile). The initial assignment attempt can fail if it
-- races ahead of Telnyx finishing provisioning the number, and until now a
-- failure there was silently logged and never retried, permanently leaving
-- the number without campaign coverage. NULL means "not yet confirmed
-- assigned" and is what the retry cron looks for.
alter table business_sms_setup
  add column if not exists campaign_assigned_at timestamptz,
  add column if not exists campaign_assignment_last_error text;
