# Recalculate-reminders Database Webhook

`/api/sms/recalculate-reminders` (see `app/api/sms/recalculate-reminders/route.ts`)
re-queues a business's future SMS reminders whenever its reminder rules or
relevant business settings change. It's meant to be triggered by the
database itself, not by the app -- that way it fires no matter which
app/app version wrote the row, with no client update required.

This is configured once, by hand, in the Supabase dashboard (Database ->
Webhooks -> Create a new hook). It is NOT part of the migrations folder
because Database Webhooks are project-level config, not schema.

## 1. Vercel environment variable

Project Settings -> Environment Variables:

- `RECALC_REMINDERS_WEBHOOK_SECRET` -- a random secret shared between
  Supabase and this endpoint. Generate one with `openssl rand -hex 32`.
  Never commit the actual value anywhere in this repo.

Redeploy after adding it.

## 2. Webhook on `business_sms_reminder_rules`

- Name: `recalc_reminders_on_rule_change`
- Table: `business_sms_reminder_rules`
- Events: Insert, Update
- Type: HTTP Request
- Method: POST
- URL: `https://www.wagzly.com/api/sms/recalculate-reminders`
- HTTP headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <RECALC_REMINDERS_WEBHOOK_SECRET value>`

## 3. Webhook on `business_settings`

Same as above, except:

- Name: `recalc_reminders_on_business_settings_change`
- Table: `business_settings`
- Events: Update only (arrival window / timezone / sms_enabled all live
  on this row; there's no reason to fire on insert since a brand new
  business has no appointments yet)

## Why a secret instead of just checking business ownership

The webhook call comes straight from Supabase's infrastructure, not a
signed-in user -- there's no user JWT to check against `profiles`. The
route accepts either a valid user session (for a business owner calling
it directly) or this shared secret (for the webhook). See the auth
branch at the top of the route handler.

## Rollout

The route still hard-gates to one business id
(`TEST_BUSINESS_ID` in the route file) while this is validated against a
real queue. Once confirmed correct, delete that check to open it up to
every business -- the webhooks above don't need to change.
