-- Lets the cron-driven SMS queue processor push a "you're out of SMS
-- credits" notification without spamming one every 5 minutes for as long
-- as the business stays over its limit -- only send again once it's been
-- a while since the last one.
alter table business_sms_setup
  add column if not exists credits_exhausted_notified_at timestamptz;
