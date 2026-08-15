-- Report Cards: a post-appointment, per-pet summary (before/after photos,
-- mood/behavior tags, a themed "how did it go" note) hosted at a short
-- public link and texted to the client. Mirrors the message-attachment
-- short-link pattern (private storage bucket + signed URLs generated
-- per-view, resolved through a backend route rather than direct RLS on
-- storage) since photo uploads and the public read both go through
-- service-role backend routes rather than client-direct storage access.

-- Business-scoped mood/behavior tags (e.g. "Happy 😄", "Well behaved 💗").
-- Manageable from Settings and creatable inline from the report card itself.
create table pet_report_tags (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  label text not null,
  emoji text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table pet_report_tags enable row level security;

create policy pet_report_tags_select_own_business on pet_report_tags
  for select using (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

create policy pet_report_tags_insert_own_business on pet_report_tags
  for insert with check (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

create policy pet_report_tags_update_own_business on pet_report_tags
  for update using (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

-- One report card per pet per appointment. `short_id` is generated
-- app-side (same no-ambiguous-character alphabet + collision-retry
-- pattern already used for message_attachment_links) and is what the
-- public link (wagzly.com/report/<short_id>) resolves against.
create table pet_report_cards (
  id uuid primary key default gen_random_uuid(),
  short_id text not null unique,
  business_id uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  theme text not null default 'rose_petal',
  headline text,
  tag_ids uuid[] not null default '{}',
  note text,
  before_photo_path text,
  after_photo_path text,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  -- Set to sent_at + 3 days when the report is actually sent (not at
  -- creation) -- a draft sitting around doesn't burn into the client's
  -- viewing window before they've even received the link.
  expires_at timestamptz
);

alter table pet_report_cards enable row level security;

create policy pet_report_cards_select_own_business on pet_report_cards
  for select using (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

create policy pet_report_cards_insert_own_business on pet_report_cards
  for insert with check (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

create policy pet_report_cards_update_own_business on pet_report_cards
  for update using (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  ) with check (
    business_id in (select profiles.business_id from profiles where profiles.id = auth.uid())
  );

create index pet_report_cards_appointment_pet_idx on pet_report_cards (appointment_id, pet_id);

-- Private bucket -- uploads and the public-facing read both go through
-- service-role backend routes (app/api/reports/upload-photo,
-- app/api/reports/[shortId]), so no storage.objects RLS policy is needed;
-- the service role bypasses RLS entirely, same as message-attachments.
insert into storage.buckets (id, name, public)
values ('report-card-photos', 'report-card-photos', false)
on conflict (id) do nothing;
