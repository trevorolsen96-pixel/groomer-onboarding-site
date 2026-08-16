-- Security audit fix: the `pet-documents` storage bucket (vaccine/medical
-- records) was public=true with a SELECT policy open to role `public`
-- (anyone, no login) and DELETE/UPDATE policies scoped only by bucket_id --
-- any authenticated user at ANY business could view, delete, or overwrite
-- any other business's uploaded pet documents.
--
-- Unlike message-attachments/report-card-photos (which are 100%
-- service-role-only, no direct client access at all), the Flutter app
-- DOES upload and delete pet-documents objects directly from the
-- authenticated client (see pet_editor_screen.dart / pet_repository.dart),
-- always under a `{businessId}/{customerId}/{petId}/...` path. So instead
-- of locking writes down to service-role-only (which would break that
-- existing upload/delete flow), writes are scoped by matching the path's
-- leading business_id segment against the caller's own business -- same
-- effect (can't touch another business's files) without changing the
-- app's upload/delete code.
--
-- Reads are handled differently: the bucket goes fully private and gets
-- NO client-facing SELECT policy at all (same as the other private
-- buckets) -- viewing now goes through a new signed-URL route
-- (app/api/pet-documents/view-url), matching the pattern already used for
-- report card photos. The Flutter display code is updated in the same
-- change to fetch a fresh signed URL instead of using the old public URL
-- that was stored in pet_documents.file_url at upload time.

update storage.buckets set public = false where id = 'pet-documents';

drop policy if exists "Anyone can view pet documents" on storage.objects;
drop policy if exists "Authenticated users can delete pet documents" on storage.objects;
drop policy if exists "Authenticated users can update pet documents" on storage.objects;
drop policy if exists "Authenticated users can upload pet documents" on storage.objects;

create policy "insert own business pet documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pet-documents'
    and (storage.foldername(name))[1] = (
      select profiles.business_id::text from profiles where profiles.id = auth.uid()
    )
  );

create policy "update own business pet documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-documents'
    and (storage.foldername(name))[1] = (
      select profiles.business_id::text from profiles where profiles.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'pet-documents'
    and (storage.foldername(name))[1] = (
      select profiles.business_id::text from profiles where profiles.id = auth.uid()
    )
  );

create policy "delete own business pet documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-documents'
    and (storage.foldername(name))[1] = (
      select profiles.business_id::text from profiles where profiles.id = auth.uid()
    )
  );
