import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText, smsSegments } from "../../../../lib/sms-text";
import { verifyCronRequest } from "../../../../lib/cron-auth";
import { sendPushToBusinessAsync } from "../../../../lib/push-notification";

// How long to wait before sending another "you're out of SMS credits"
// push for the same business -- this cron runs every 5 minutes, and
// staying over the limit is a persistent state, not a one-off event, so
// without this a business would get a new push every 5 minutes for as
// long as they're over.
const CREDITS_EXHAUSTED_RENOTIFY_HOURS = 12;

async function notifyCreditsExhaustedIfNeeded(businessId: string) {
  const { data: setup } = await supabaseAdmin
    .from("business_sms_setup")
    .select("credits_exhausted_notified_at")
    .eq("business_id", businessId)
    .maybeSingle();

  const lastNotified = setup?.credits_exhausted_notified_at
    ? new Date(setup.credits_exhausted_notified_at).getTime()
    : 0;
  const hoursSinceLastNotified = (Date.now() - lastNotified) / (1000 * 60 * 60);

  if (hoursSinceLastNotified < CREDITS_EXHAUSTED_RENOTIFY_HOURS) return;

  await supabaseAdmin
    .from("business_sms_setup")
    .update({ credits_exhausted_notified_at: new Date().toISOString() })
    .eq("business_id", businessId);

  await sendPushToBusinessAsync({
    businessId,
    title: "Out of SMS Credits",
    body: "Appointment reminders and confirmations are not sending because you're out of SMS credits.",
    data: { type: "sms_credits_exhausted", route: "sms_settings" },
  });
}

async function assertSmsCreditsAvailable({
  businessId,
  body,
}: {
  businessId: string;
  body: string;
}) {
  const neededCredits = smsSegments(body);

  const { data, error } = await supabaseAdmin.rpc("get_sms_credit_summary", {
    p_business_id: businessId,
  });

  if (error) throw new Error(error.message);

  const summary = Array.isArray(data) ? data[0] : data;
  const remainingCredits = Number(summary?.remaining_credits ?? 0);
  const plan = String(summary?.plan ?? "basic").toLowerCase();

  if (remainingCredits < neededCredits) {
    throw new Error(
      `sms_credits_exceeded plan=${plan} needed=${neededCredits} remaining=${remainingCredits}`
    );
  }
}

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const now = new Date().toISOString();

    const { data: queueRows, error } = await supabaseAdmin
      .from("sms_outbound_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for_utc", now)
      .order("scheduled_for_utc", { ascending: true })
      .limit(25);

    if (error) throw new Error(error.message);

    let sentCount = 0;

    for (const row of queueRows ?? []) {
      try {
        // Normalizing here (not just at each queue-writer) guarantees every
        // send is cleaned up regardless of which route queued it — cheap
        // and a no-op if the text is already plain ASCII.
        const messageBody = normalizeSmsText(String(row.body_rendered ?? "").trim());

        if (!messageBody) {
          await supabaseAdmin
            .from("sms_outbound_queue")
            .update({
              status: "failed",
              attempt_count: (row.attempt_count ?? 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          continue;
        }

        const { data: smsSetup } = await supabaseAdmin
          .from("business_sms_setup")
          .select("status, phone_number")
          .eq("business_id", row.business_id)
          .maybeSingle();

        if (
          !smsSetup ||
          !["active", "approved"].includes(smsSetup.status ?? "") ||
          !smsSetup.phone_number
        ) {
          await supabaseAdmin
            .from("sms_outbound_queue")
            .update({
              status: "failed",
              attempt_count: (row.attempt_count ?? 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          continue;
        }

        await assertSmsCreditsAvailable({
          businessId: row.business_id,
          body: messageBody,
        });

        const providerMessageId = await sendSms({
          from: smsSetup.phone_number,
          to: row.to_phone,
          text: messageBody,
        });

        const nowIso = new Date().toISOString();

        await supabaseAdmin
          .from("sms_outbound_queue")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            attempt_count: (row.attempt_count ?? 0) + 1,
            updated_at: nowIso,
          })
          .eq("id", row.id);

        await supabaseAdmin.from("sms_events").insert({
          business_id: row.business_id,
          appointment_id: row.appointment_id,
          customer_id: row.customer_id,
          direction: "outbound",
          event_type: row.message_type,
          message_body: messageBody,
          from_phone: smsSetup.phone_number,
          to_phone: row.to_phone,
          created_at: nowIso,
        });

        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("id, name, phone, image_url")
          .eq("id", row.customer_id)
          .eq("business_id", row.business_id)
          .maybeSingle();

        if (customer) {
          const { data: existingConversation } = await supabaseAdmin
            .from("message_conversations")
            .select("id")
            .eq("business_id", row.business_id)
            .eq("customer_id", row.customer_id)
            .eq("contact_type", "primary")
            .maybeSingle();

          let conversationId = existingConversation?.id as string | undefined;

          if (!conversationId) {
            const { data: insertedConversation } = await supabaseAdmin
              .from("message_conversations")
              .insert({
                business_id: row.business_id,
                customer_id: row.customer_id,
                contact_type: "primary",
                customer_name: customer.name,
                customer_phone: customer.phone,
                customer_image_url: customer.image_url,
                last_message_body: messageBody,
                last_message_at: nowIso,
                unread_count: 0,
                created_at: nowIso,
              })
              .select("id")
              .single();

            conversationId = insertedConversation?.id;
          }

          if (conversationId) {
            await supabaseAdmin.from("message_items").insert({
              business_id: row.business_id,
              conversation_id: conversationId,
              customer_id: row.customer_id,
              direction: "outbound",
              body: messageBody,
              status: "sent",
              provider: "telnyx",
              created_at: nowIso,
            });

            await supabaseAdmin
              .from("message_conversations")
              .update({ last_message_body: messageBody, last_message_at: nowIso })
              .eq("id", conversationId);
          }
        }

        sentCount++;
      } catch (err) {
        await supabaseAdmin
          .from("sms_outbound_queue")
          .update({
            status: "failed",
            attempt_count: (row.attempt_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("sms_credits_exceeded")) {
          await notifyCreditsExhaustedIfNeeded(row.business_id);
        }
      }
    }

    return NextResponse.json({ ok: true, sentCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process SMS queue.",
      },
      { status: 400 }
    );
  }
}
