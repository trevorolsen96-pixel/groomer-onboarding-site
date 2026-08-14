import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { smsSegments, splitLongSmsMessage } from "../../../../lib/sms-text";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return null;
}

// Total segments a single send of this message actually costs, accounting
// for the auto-split into two texts when it's over the 10-segment limit
// (10 + 10 always covers up to 20 — see lib/sms-text.ts).
function totalSegmentsForMessage(messageBody: string): { segments: number; error?: string } {
  if (!messageBody) return { segments: 1 };

  const result = splitLongSmsMessage(messageBody);
  if (!result.ok) return { segments: 0, error: result.error };

  return { segments: result.parts.reduce((sum, part) => sum + smsSegments(part), 0) };
}

async function getAuth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim() ?? "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// GET — preview: returns recipient count, credits needed, credits available
export async function GET(request: Request) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId") ?? "";
    const messageBody = url.searchParams.get("message") ?? "";

    if (!businessId) return NextResponse.json({ error: "businessId required." }, { status: 400 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    // Count active customers with phone numbers
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, phone")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("deleted", false);

    const eligible = (customers ?? []).filter((c) => {
      const phone = normalizePhone(c.phone ?? "");
      return phone !== null;
    });

    const recipientCount = eligible.length;
    const { segments, error: lengthError } = totalSegmentsForMessage(messageBody);
    const creditsNeeded = segments * recipientCount;

    // Get remaining credits
    const { data: creditData } = await supabaseAdmin.rpc("get_sms_credit_summary", {
      p_business_id: businessId,
    });
    const summary = Array.isArray(creditData) ? creditData[0] : creditData;
    const remainingCredits = Number(summary?.remaining_credits ?? 0);

    return NextResponse.json({
      recipientCount,
      segments,
      creditsNeeded,
      remainingCredits,
      canSend: !lengthError && remainingCredits >= creditsNeeded,
      error: lengthError,
      willSplit: segments > 10,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST — send the mass message
export async function POST(request: Request) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json();
    const businessId = cleanText(body.businessId);
    const messageBody = cleanText(body.messageBody);

    if (!businessId || !messageBody) {
      return NextResponse.json({ error: "businessId and messageBody are required." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    // Check SMS setup
    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!smsSetup || !["active", "approved"].includes(smsSetup.status ?? "") || !smsSetup.phone_number) {
      return NextResponse.json({ error: "Text messaging is not set up for this business." }, { status: 400 });
    }

    // Fetch active customers with phones
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, phone, name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("deleted", false);

    const eligible = (customers ?? [])
      .map((c) => ({ ...c, normalizedPhone: normalizePhone(c.phone ?? "") }))
      .filter((c) => c.normalizedPhone !== null) as Array<{
        id: string; phone: string; name: string; normalizedPhone: string;
      }>;

    if (eligible.length === 0) {
      return NextResponse.json({ error: "No active clients with phone numbers found." }, { status: 400 });
    }

    // Clean up autocorrect typography, and split into two texts if needed
    // (or reject outright if it's too long even for that) — same rule as
    // a manually-typed 1:1 message.
    const splitResult = splitLongSmsMessage(messageBody);

    if (!splitResult.ok) {
      return NextResponse.json({ error: splitResult.error }, { status: 400 });
    }

    const parts = splitResult.parts;
    const segmentsPerRecipient = parts.reduce((sum, part) => sum + smsSegments(part), 0);
    const creditsNeeded = segmentsPerRecipient * eligible.length;

    // Check credits — hard block
    const { data: creditData, error: creditError } = await supabaseAdmin.rpc("get_sms_credit_summary", {
      p_business_id: businessId,
    });

    if (creditError) throw new Error("Unable to verify SMS credits.");

    const summary = Array.isArray(creditData) ? creditData[0] : creditData;
    const remainingCredits = Number(summary?.remaining_credits ?? 0);

    if (remainingCredits < creditsNeeded) {
      return NextResponse.json({
        error: `sms_credits_exceeded needed=${creditsNeeded} remaining=${remainingCredits}`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const fromPhone = smsSetup.phone_number as string;

    // Queue one row per (recipient, part) — a message that needed to split
    // into 2 texts gets 2 queue rows per recipient, each sent independently
    // by the same queue processor that already handles every other SMS
    // type, so nothing downstream needs to know splitting happened at all.
    const queueRows = eligible.flatMap((customer) =>
      parts.map((part, partIndex) => ({
        business_id: businessId,
        customer_id: customer.id,
        appointment_id: null,
        message_type: "mass_message",
        rule_type: "immediate",
        to_phone: customer.normalizedPhone,
        body_rendered: part,
        scheduled_for_utc: now,
        status: "pending",
        dedupe_key: `mass:${businessId}:${customer.id}:${Date.now()}:${partIndex}`,
        attempt_count: 0,
        updated_at: now,
      }))
    );

    await supabaseAdmin.from("sms_outbound_queue").insert(queueRows);

    // Insert mass_messages record
    const { data: massMsg } = await supabaseAdmin
      .from("mass_messages")
      .insert({
        business_id: businessId,
        message_body: messageBody,
        recipient_count: eligible.length,
        credits_used: creditsNeeded,
        sent_at: now,
      })
      .select("id")
      .single();

    return NextResponse.json({
      ok: true,
      massMessageId: massMsg?.id,
      recipientCount: eligible.length,
      creditsUsed: creditsNeeded,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to send mass message.",
    }, { status: 400 });
  }
}
