import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText, smsSegments } from "../../../../lib/sms-text";
import { logOutboundSmsToConversation } from "../../../../lib/sms-conversation-log";

const REPORT_TTL_DAYS = 3;

// A second send of the same report inside this window is treated as a
// retry of the first, not a request to text the client again. The usual
// cause is the app losing its connection after the SMS already went out
// (iOS "Bad file descriptor" on a network handoff) and the groomer
// tapping Send again, which used to double-text the client.
const DUPLICATE_SEND_WINDOW_MS = 5 * 60 * 1000;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return `+1${digits}`;
}

async function assertSmsCreditsAvailable(businessId: string, neededCredits: number) {
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
    const reportCardId = cleanText(body.reportCardId);

    if (!businessId || !reportCardId) {
      return NextResponse.json(
        { error: "Missing report card details." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: smsSetup } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      !smsSetup ||
      !["active", "approved"].includes(smsSetup.status ?? "") ||
      !smsSetup.phone_number
    ) {
      return NextResponse.json(
        { error: "sms_not_activated" },
        { status: 400 }
      );
    }

    const { data: reportCard } = await supabaseAdmin
      .from("pet_report_cards")
      .select(
        "id, short_id, pet_id, customer_id, before_photo_path, after_photo_path, status, sent_at, expires_at"
      )
      .eq("id", reportCardId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!reportCard) {
      return NextResponse.json(
        { error: "Report card not found." },
        { status: 404 }
      );
    }

    if (!reportCard.before_photo_path && !reportCard.after_photo_path) {
      return NextResponse.json(
        { error: "Add at least one photo before sending the report." },
        { status: 400 }
      );
    }

    const { data: pet } = await supabaseAdmin
      .from("pets")
      .select("name")
      .eq("id", reportCard.pet_id)
      .maybeSingle();

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, image_url")
      .eq("id", reportCard.customer_id)
      .maybeSingle();

    if (!customer || !customer.phone) {
      return NextResponse.json(
        { error: "This customer does not have a phone number." },
        { status: 400 }
      );
    }

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("business_name")
      .eq("business_id", businessId)
      .maybeSingle();

    const businessName = cleanText(settings?.business_name) || "Your groomer";
    const petName = cleanText(pet?.name) || "Your pet";

    // short_id is generated client-side at draft-creation time (it's a
    // NOT NULL column) with the same collision-retry pattern as
    // message-attachment short links, so it's always already present here.
    const shortId = reportCard.short_id as string;
    const reportUrl = `https://www.wagzly.com/report/${shortId}`;
    const messageBody = normalizeSmsText(
      `${businessName} just finished ${petName}'s grooming! See how it went: ${reportUrl}`
    );

    await assertSmsCreditsAvailable(businessId, smsSegments(messageBody));

    const fromPhone = normalizePhone(smsSetup.phone_number);
    const toPhone = normalizePhone(customer.phone);

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + REPORT_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const duplicateCutoffIso = new Date(
      Date.now() - DUPLICATE_SEND_WINDOW_MS
    ).toISOString();

    // Claim the send before texting: this conditional update only matches
    // if the report hasn't been sent within the duplicate window, so two
    // overlapping requests can't both get through.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("pet_report_cards")
      .update({
        status: "sent",
        sent_at: nowIso,
        expires_at: expiresAt,
        updated_at: nowIso,
      })
      .eq("id", reportCardId)
      .or(`sent_at.is.null,sent_at.lt.${duplicateCutoffIso}`)
      .select("id");

    if (claimError) throw new Error(claimError.message);

    if (!claimed || claimed.length === 0) {
      return NextResponse.json({
        ok: true,
        url: reportUrl,
        expiresAt: reportCard.expires_at ?? expiresAt,
        alreadySent: true,
      });
    }

    try {
      await sendSms({ from: fromPhone, to: toPhone, text: messageBody });
    } catch (sendError) {
      // Put the card back the way it was so the groomer can retry.
      await supabaseAdmin
        .from("pet_report_cards")
        .update({
          status: reportCard.status,
          sent_at: reportCard.sent_at,
          expires_at: reportCard.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportCardId);
      throw sendError;
    }

    await supabaseAdmin.from("sms_events").insert({
      business_id: businessId,
      customer_id: customer.id,
      direction: "outbound",
      event_type: "report_card",
      message_body: messageBody,
      from_phone: fromPhone,
      to_phone: toPhone,
      created_at: nowIso,
    });

    try {
      await logOutboundSmsToConversation({
        businessId,
        customerId: customer.id,
        customerName: customer.name ?? "Client",
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        body: messageBody,
      });
    } catch (usageLogError) {
      console.error("Failed to log report card SMS usage:", usageLogError);
    }

    return NextResponse.json({ ok: true, url: reportUrl, expiresAt });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send report card.",
      },
      { status: 400 }
    );
  }
}
