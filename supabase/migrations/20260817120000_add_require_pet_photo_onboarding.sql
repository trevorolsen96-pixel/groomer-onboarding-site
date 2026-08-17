-- Lets a groomer require clients to upload a pet photo during online
-- onboarding, mirroring the existing require_pet_records_onboarding toggle.
-- Defaults to false so existing businesses aren't suddenly blocking
-- submissions that used to go through without a photo.
alter table business_settings
  add column require_pet_photo_onboarding boolean not null default false;
