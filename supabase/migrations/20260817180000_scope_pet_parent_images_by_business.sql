-- pet-parent-images write policies previously only checked bucket_id, with
-- no business scoping at all -- any authenticated user, from any business,
-- could upload/overwrite/delete any file in this bucket. This closes that
-- gap the same way pet-documents was already locked down, but the four
-- code paths that upload here don't share one folder convention, so the
-- check has to recognize all four instead of assuming business_id is
-- always the first path segment:
--   {businessId}/{customerId}/...                 (pet editor main photo)
--   business_logos/{businessId}/...                (business logo)
--   customer_images/{businessId}/{customerId}/...  (customer profile photo)
--   pet_photos/{petId}/...                         (pet photo gallery --
--     business_id isn't in the path at all, resolved via the pets table)
create or replace function storage_caller_owns_pet_parent_image_path(object_name text)
returns boolean
language sql
stable
as $$
  select case
    when (storage.foldername(object_name))[1] =
      (select business_id::text from profiles where id = auth.uid())
      then true
    when (storage.foldername(object_name))[1] = 'business_logos'
      and (storage.foldername(object_name))[2] =
        (select business_id::text from profiles where id = auth.uid())
      then true
    when (storage.foldername(object_name))[1] = 'customer_images'
      and (storage.foldername(object_name))[2] =
        (select business_id::text from profiles where id = auth.uid())
      then true
    when (storage.foldername(object_name))[1] = 'pet_photos'
      and exists (
        select 1 from pets
        where pets.id::text = (storage.foldername(object_name))[2]
          and pets.business_id = (select business_id from profiles where id = auth.uid())
      )
      then true
    else false
  end;
$$;

drop policy if exists "authenticated users can upload pet parent images" on storage.objects;
drop policy if exists "authenticated users can update pet parent images" on storage.objects;
drop policy if exists "authenticated users can delete pet parent images" on storage.objects;

create policy "insert own business pet parent images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pet-parent-images'
  and storage_caller_owns_pet_parent_image_path(name)
);

create policy "update own business pet parent images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pet-parent-images'
  and storage_caller_owns_pet_parent_image_path(name)
)
with check (
  bucket_id = 'pet-parent-images'
  and storage_caller_owns_pet_parent_image_path(name)
);

create policy "delete own business pet parent images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pet-parent-images'
  and storage_caller_owns_pet_parent_image_path(name)
);
