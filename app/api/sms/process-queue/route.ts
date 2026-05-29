import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";

function smsSegmentsForText(body: string) {
  return Math.max(1, Math.ceil(body.length / 160));
}

async function assertSmsCreditsAvailable({
  businessId,
  body,
}: {
  businessId: string;
  body: string;
}) {
  const neededCredits = smsSegmentsForText(body);

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

export async function GET() {
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
        const messageBody = String(row.body_rendered ?? "").trim();

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
            .maybeSingle();

          let conversationId = existingConversation?.id as string | undefined;

          if (!conversationId) {
            const { data: insertedConversation } = await supabaseAdmin
              .from("message_conversations")
              .insert({
                business_id: row.business_id,
                customer_id: row.customer_id,
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
      } catch {
        await supabaseAdmin
          .from("sms_outbound_queue")
          .update({
            status: "failed",
            attempt_count: (row.attempt_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
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
