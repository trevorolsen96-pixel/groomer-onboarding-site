import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAdminProfileIds, sendPushToProfilesAsync } from "@/lib/push-notification";

// How long a completed OTP verification remains good for submitting a
// booking request -- generous on purpose, since a client might spend a
// few minutes picking pets/services/a date after verifying their email.
const OTP_REUSE_WINDOW_MINUTES = 30;

export async function POST(req: NextRequest) {
  const {
    businessId,
    customerId,
    petIds,
    serviceId,
    requestedDate,
    requestedTime,
    clientName,
    clientEmail,
    clientPhone,
    otpId,
  } = await req.json();

  if (!businessId || !serviceId || !requestedDate || !clientEmail) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!petIds || petIds.length === 0) {
    return NextResponse.json({ error: "At least one pet is required." }, { status: 400 });
  }

  // This route used to accept a submission with no proof the OTP step
  // (app/api/book/otp/verify) ever actually happened -- it could be POSTed
  // to directly, skipping email verification entirely. Require the id of
  // a real, used, matching, still-fresh verification row instead.
  if (!otpId) {
    return NextResponse.json(
      { error: "Please verify your email before submitting." },
      { status: 403 }
    );
  }

  const { data: otpRow } = await supabaseAdmin
    .from("booking_otps")
    .select("email, business_id, used, expires_at")
    .eq("id", otpId)
    .maybeSingle();

  const otpExpiresAt = otpRow ? new Date(otpRow.expires_at).getTime() : 0;
  const withinReuseWindow =
    Date.now() - otpExpiresAt < OTP_REUSE_WINDOW_MINUTES * 60 * 1000;

  if (
    !otpRow ||
    !otpRow.used ||
    otpRow.business_id !== businessId ||
    otpRow.email !== String(clientEmail).toLowerCase() ||
    !withinReuseWindow
  ) {
    return NextResponse.json(
      { error: "Email verification is missing or has expired. Please verify your email again." },
      { status: 403 }
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("booking_requests")
    .insert({
      business_id: businessId,
      customer_id: customerId ?? null,
      pet_ids: petIds,
      service_id: serviceId,
      requested_date: requestedDate,
      requested_time: requestedTime ?? null,
      client_name: clientName ?? null,
      client_email: clientEmail.toLowerCase(),
      client_phone: clientPhone ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }

  // Booking requests aren't assigned to any specific staff member -- they're
  // a pending item someone has to review/approve -- so this goes to admins
  // only, not every groomer on the account.
  const adminProfileIds = await resolveAdminProfileIds(businessId);
  if (adminProfileIds.length) {
    await sendPushToProfilesAsync({
      businessId,
      profileIds: adminProfileIds,
      title: "New Booking Request",
      body: `${clientName ?? "A client"} requested an appointment.`,
      data: {
        route: "booking_requests",
        type: "booking_request",
        requestId: inserted?.id ?? "",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
