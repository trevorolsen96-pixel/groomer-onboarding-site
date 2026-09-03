# Recalculate-reminders Database Webhook

`/api/sms/recalculate-reminders` (see `app/api/sms/recalculate-reminders/route.ts`)
re-queues a business's future SMS reminders whenever its reminder rules or
relevant business settings change. It's meant to be triggered by the
database itself, not by the app -- that way it fires no matter which
app/app version wrote the row, with no client update required.

This is configured once, by hand, via SQL run in the Supabase SQL Editor.
It is NOT part of the migrations folder because it's project-level async
infra (a trigger calling out over the network), not application schema.

This project doesn't have the `supabase_functions` wrapper schema
provisioned (that only exists once a project has used the Dashboard's
Database Webhooks UI at least once), so this uses `pg_net` -- the actual
extension that performs the async HTTP call -- directly, via a small
trigger function of our own, instead of Supabase's `supabase_functions.
http_request()` convenience wrapper.

## 1. Vercel environment variable

Project Settings -> Environment Variables:

- `RECALC_REMINDERS_WEBHOOK_SECRET` -- a random secret shared between
  the trigger function below and this endpoint. Generate one with
  `openssl rand -hex 32`. Never commit the actual value anywhere in this
  repo.

Redeploy after adding it.

## 2. Trigger function + triggers (SQL Editor)

```sql
create extension if not exists pg_net;

create or replace function public.recalc_sms_reminders_webhook()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
  );

  perform net.http_post(
    url := 'https://www.wagzly.com/api/sms/recalculate-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <RECALC_REMINDERS_WEBHOOK_SECRET value>"}'::jsonb,
    body := payload
  );

  return NEW;
end;
$$;

create trigger recalc_reminders_on_rule_change
after insert or update on public.business_sms_reminder_rules
for each row
execute function public.recalc_sms_reminders_webhook();

create trigger recalc_reminders_on_business_settings_change
after update on public.business_settings
for each row
execute function public.recalc_sms_reminders_webhook();
```

The payload shape (`{type, table, schema, record, old_record}`) matches
what `supabase_functions.http_request()` would have sent, so the route's
`record.business_id` extraction works the same either way -- if this
project ever gets the Dashboard Webhooks UI initialized later, these SQL
triggers can be dropped and recreated through that UI instead with no
route changes needed.

## Why a secret instead of just checking business ownership

The webhook call comes straight from Supabase's infrastructure, not a
signed-in user -- there's no user JWT to check against `profiles`. The
route accepts either a valid user session (for a business owner calling
it directly) or this shared secret (for the webhook). See the auth
branch at the top of the route handler.

## Rollout

Validated against a real queue on one business first (a hard-coded
`TEST_BUSINESS_ID` gate in the route), then opened up to every business
once confirmed correct -- the trigger/webhook setup above didn't need to
change for that, since the gate lived entirely in the route.
