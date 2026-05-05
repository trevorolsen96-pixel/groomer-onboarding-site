import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio environment variables are missing.");
  }

  return twilio(accountSid, authToken);
}

export async function GET(request: Request) {
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

    const client = getTwilioClient();
    let sentCount = 0;

    for (const row of queueRows ?? []) {
      try {
        const { data: smsSetup } = await supabaseAdmin
          .from("business_sms_setup")
          .select("status, phone_number")
          .eq("business_id", row.business_id)
          .maybeSingle();

        if (!smsSetup || smsSetup.status !== "approved" || !smsSetup.phone_number) {
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

        const sent = await client.messages.create({
          from: smsSetup.phone_number,
          to: row.to_phone,
          body: row.body_rendered,
        });

        await supabaseAdmin
          .from("sms_outbound_queue")
          .update({
            status: "sent",
            provider_message_id: sent.sid,
            attempt_count: (row.attempt_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        await supabaseAdmin.from("sms_events").insert({
          business_id: row.business_id,
          appointment_id: row.appointment_id,
          customer_id: row.customer_id,
          direction: "outbound",
          event_type: row.message_type,
          message_body: row.body_rendered,
          from_phone: smsSetup.phone_number,
          to_phone: row.to_phone,
          created_at: new Date().toISOString(),
        });

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