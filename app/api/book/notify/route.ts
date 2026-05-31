import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/telnyx";

export async function POST(req: NextRequest) {
  const { requestId, status } = await req.json();

  if (!requestId || !status) {
    return NextResponse.json({ error: "requestId and status are required." }, { status: 400 });
  }

  // Load the booking request
  const { data: request, error: reqError } = await supabaseAdmin
    .from("booking_requests")
    .select("client_phone, client_name, requested_date, requested_time, rescheduled_date, rescheduled_time, business_id, groomer_note")
    .eq("id", requestId)
    .maybeSingle();

  if (reqError || !request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const rawPhone = request.client_phone as string | null;
  if (!rawPhone) {
    console.log(`[book/notify] skipped — no client_phone on request ${requestId}`);
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
    text = `Hi ${firstName}! Your grooming appt with ${businessName} is confirmed for ${dateStr}${timeStr}. See you then!`;
  } else {
    text = `Hi ${firstName}, ${businessName} can't confirm your grooming request for ${dateStr}. Please reach out to reschedule.`;
  }

  try {
    await sendSms({ from, to: phone, text });
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
