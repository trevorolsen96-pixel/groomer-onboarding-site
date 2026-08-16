import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/telnyx";
import { normalizeSmsText, smsSegments } from "@/lib/sms-text";
import { logOutboundSmsToConversation, logOutboundSmsUsageOnly } from "@/lib/sms-conversation-log";

// This route is only ever called by the app itself (a staff member
// approving/declining a booking or onboarding request) -- never by the
// public site -- so it requires a real session, and that session's own
// business must match whichever business_id this call is acting on. It
// previously trusted businessId/requestId straight from the request body
// with no auth at all, which meant anyone who knew (or guessed) a
// businessId could make that business's real SMS number text an arbitrary
// phone number, unlimited times, with no credit-limit check.
async function _authorizeCaller(
  req: NextRequest
): Promise<{ businessId: string } | { error: NextResponse }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("business_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.business_id) {
    return { error: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  }

  return { businessId: profile.business_id as string };
}

async function _assertSmsCreditsAvailable(businessId: string, neededCredits: number) {
  const { data, error } = await supabaseAdmin.rpc("get_sms_credit_summary", {
    p_business_id: businessId,
  });

  if (error) {
    throw new Error("Unable to verify SMS credits.");
  }

  const summary = Array.isArray(data) ? data[0] : data;
  const remainingCredits = Number(summary?.remaining_credits ?? 0);
  const plan = String(summary?.plan ?? "basic").toLowerCase();

  if (remainingCredits < neededCredits) {
    throw new Error(
      `sms_credits_exceeded plan=${plan} needed=${neededCredits} remaining=${remainingCredits}`
    );
  }
}

export async function POST(req: NextRequest) {
  const { requestId, status, clientPhone, businessId: directBusinessId, customerId } = await req.json();

  if (!requestId || !status) {
    return NextResponse.json({ error: "requestId and status are required." }, { status: 400 });
  }

  const authResult = await _authorizeCaller(req);
  if ("error" in authResult) return authResult.error;
  const callerBusinessId = authResult.businessId;

  // Handle onboarding accepted — uses onboarding_requests table
  if (status === "onboarding_accepted") {
    if (!clientPhone || !directBusinessId) {
      return NextResponse.json({ ok: true, skipped: "no_phone_or_business" });
    }

    if (callerBusinessId !== directBusinessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const phone = _toE164(clientPhone);
    if (!phone) return NextResponse.json({ ok: true, skipped: "bad_phone_format" });

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("sms_sender_number, business_name")
      .eq("business_id", directBusinessId)
      .maybeSingle();

    const from = settings?.sms_sender_number as string | null;
    if (!from) return NextResponse.json({ ok: true, skipped: "no_sender_number" });

    const businessName = (settings?.business_name as string | null) ?? "Your groomer";
    const text = normalizeSmsText(
      `Welcome to ${businessName}! Your profile is set up and you're ready to book. We look forward to seeing your pup!`
    );

    try {
      await _assertSmsCreditsAvailable(directBusinessId, smsSegments(text));
      await sendSms({ from, to: phone, text });

      // Log it against the client's conversation (and therefore the credit
      // ledger) if their customer record already exists by now -- it
      // usually does, since this fires right after onboarding creates one.
      // Best-effort: a lookup/logging failure should never surface as a
      // failed welcome text, since the SMS itself already went out.
      try {
        const { data: matchedCustomer } = await supabaseAdmin
          .from("customers")
          .select("id, name, phone, image_url")
          .eq("business_id", directBusinessId)
          .eq("phone", phone)
          .maybeSingle();

        if (matchedCustomer) {
          await logOutboundSmsToConversation({
            businessId: directBusinessId,
            customerId: matchedCustomer.id,
            customerName: matchedCustomer.name,
            customerPhone: matchedCustomer.phone,
            customerImageUrl: matchedCustomer.image_url,
            body: text,
          });
        } else {
          await logOutboundSmsUsageOnly({
            businessId: directBusinessId,
            body: text,
            eventType: "onboarding_welcome",
          });
        }
      } catch (usageLogError) {
        console.error("Failed to log welcome SMS usage:", usageLogError);
      }
    } catch (err) {
      console.error("SMS send failed:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // Load the booking request
  const { data: request, error: reqError } = await supabaseAdmin
    .from("booking_requests")
    .select("client_phone, client_name, requested_date, requested_time, rescheduled_date, rescheduled_time, business_id, groomer_note, customer_id")
    .eq("id", requestId)
    .maybeSingle();

  if (reqError || !request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (callerBusinessId !== request.business_id) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let rawPhone = request.client_phone as string | null;

  // Fall back to customer record if booking request has no phone
  if (!rawPhone && customerId) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("phone")
      .eq("id", customerId)
      .maybeSingle();
    rawPhone = customer?.phone as string | null;
  }

  if (!rawPhone) {
    console.log(`[book/notify] skipped — no phone on request ${requestId} or customer ${customerId}`);
    return NextResponse.json({ ok: true, skipped: "no_phone" });
  }

  const phone = _toE164(rawPhone);
  if (!phone) {
    console.log(`[book/notify] skipped — could not normalize phone "${rawPhone}" to E.164`);
    return NextResponse.json({ ok: true, skipped: "bad_phone_format" });
  }

  // Load the groomer's SMS sender number and business name
  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("sms_sender_number, business_name")
    .eq("business_id", request.business_id)
    .maybeSingle();

  const from = settings?.sms_sender_number as string | null;
  if (!from) {
    console.log(`[book/notify] skipped — no sms_sender_number for business ${request.business_id}`);
    return NextResponse.json({ ok: true, skipped: "no_sender_number" });
  }

  const businessName = (settings?.business_name as string | null) ?? "Your groomer";
  const firstName = ((request.client_name as string | null) ?? "").split(" ")[0] || "there";

  const confirmedDate = (request.rescheduled_date ?? request.requested_date) as string;
  const confirmedTime = (request.rescheduled_time ?? request.requested_time) as string | null;
  const dateStr = _formatDate(confirmedDate);
  const timeStr = confirmedTime ? ` at ${_formatTime(confirmedTime)}` : "";

  let text: string;

  if (status === "approved") {
    text = normalizeSmsText(
      `Hi ${firstName}! Your grooming appt with ${businessName} is confirmed for ${dateStr}${timeStr}. See you then!`
    );
  } else {
    text = normalizeSmsText(
      `Hi ${firstName}, ${businessName} can't confirm your grooming request for ${dateStr}. Please reach out to reschedule.`
    );
  }

  try {
    await _assertSmsCreditsAvailable(request.business_id as string, smsSegments(text));
    await sendSms({ from, to: phone, text });

    // Same best-effort logging as the welcome text above -- counts toward
    // credits either way, and shows in Messages when we know the customer.
    try {
      const resolvedCustomerId = (request.customer_id as string | null) ?? customerId ?? null;

      if (resolvedCustomerId) {
        await logOutboundSmsToConversation({
          businessId: request.business_id as string,
          customerId: resolvedCustomerId,
          customerName: (request.client_name as string | null) ?? "Client",
          customerPhone: phone,
          body: text,
        });
      } else {
        await logOutboundSmsUsageOnly({
          businessId: request.business_id as string,
          body: text,
          eventType: `booking_${status}`,
        });
      }
    } catch (usageLogError) {
      console.error("Failed to log booking notification SMS usage:", usageLogError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SMS send failed:", err);
    // Don't fail the whole request if SMS fails
    return NextResponse.json({ ok: true, smsFailed: true });
  }
}

function _toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function _formatDate(date: string): string {
  try {
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return date;
  }
}

function _formatTime(time: string): string {
  try {
    const [h, m] = time.split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  } catch {
    return time;
  }
}
