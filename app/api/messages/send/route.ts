import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await request.json();

    const businessId = cleanText(body.businessId);
    const conversationId = cleanText(body.conversationId);
    const customerId = cleanText(body.customerId);
    const messageBody = cleanText(body.body);

    if (!businessId || !conversationId || !customerId || !messageBody) {
      return NextResponse.json(
        { error: "Missing message details." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: smsSetup, error: smsSetupError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      smsSetupError ||
      !smsSetup ||
      !["active", "approved"].includes(smsSetup.status ?? "") ||
      !smsSetup.phone_number
    ) {
      return NextResponse.json(
        { error: "sms_not_activated" },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } =
      await supabaseAdmin
        .from("message_conversations")
        .select("id, business_id, customer_id, customer_phone")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation was not found." },
        { status: 404 }
      );
    }

    const toPhone = normalizePhone(conversation.customer_phone ?? "");

    if (!toPhone) {
      return NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      );
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);

    await assertSmsCreditsAvailable({ businessId, body: messageBody });

    const providerMessageId = await sendSms({
      from: fromPhone,
      to: toPhone,
      text: messageBody,
    });

    const now = new Date().toISOString();

    await supabaseAdmin.from("message_items").insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      direction: "outbound",
      body: messageBody,
      status: "sent",
      provider: "telnyx",
      created_at: now,
    });

    await supabaseAdmin
      .from("message_conversations")
      .update({ last_message_body: messageBody, last_message_at: now })
      .eq("id", conversationId);

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customerId,
      direction: "outbound",
      event_type: "manual_message",
      message_body: messageBody,
      from_phone: fromPhone,
      to_phone: toPhone,
      created_at: now,
    });

    return NextResponse.json({ ok: true, providerMessageId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send text message.",
      },
      { status: 400 }
    );
  }
}
