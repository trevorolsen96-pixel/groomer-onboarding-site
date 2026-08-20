-- user_push_tokens lets the same physical device end up registered under
-- multiple different profile_id rows, because token registration
-- (PushNotificationService.initialize(), called on every login) only ever
-- upserts a new row -- it never removes an old login's row for the same
-- device. Cleanup previously only happened on explicit sign-out
-- (clearTokenForThisDevice()), which real-world usage (force-quit,
-- reinstall, switching test accounts) routinely skips. Net effect: one
-- physical device silently accumulates push notifications for every
-- account it's ever been logged into, not just the current one.
--
-- Two-part fix:
--  1. One-time cleanup of already-duplicated tokens -- keep only the most
--     recently updated row per fcm_token, drop the rest.
--  2. A trigger that enforces "one fcm_token belongs to exactly one
--     profile_id" going forward, at the database level -- so every future
--     login is correct immediately, independent of app version/release.

delete from public.user_push_tokens t
where exists (
  select 1
  from public.user_push_tokens t2
  where t2.fcm_token = t.fcm_token
    and t2.updated_at > t.updated_at
);

create or replace function public.enforce_single_owner_per_push_token()
returns trigger
language plpgsql
as $$
begin
  delete from public.user_push_tokens
  where fcm_token = new.fcm_token
    and profile_id <> new.profile_id;

  return new;
end;
$$;

drop trigger if exists trg_enforce_single_owner_per_push_token on public.user_push_tokens;

create trigger trg_enforce_single_owner_per_push_token
after insert or update on public.user_push_tokens
for each row
execute function public.enforce_single_owner_per_push_token();
