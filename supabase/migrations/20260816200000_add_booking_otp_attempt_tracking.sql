-- Security audit fix: booking_otps had no attempt tracking, so the 6-digit
-- email verification code (10-minute lifetime, ~900,000 possibilities) could
-- be brute-forced with unlimited guesses. This column lets otp/verify lock
-- a code out after a handful of wrong guesses instead of allowing unlimited
-- attempts against it.
alter table booking_otps add column if not exists failed_attempts integer not null default 0;
