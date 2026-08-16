import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBookingOtpEmail } from "@/lib/email";

// Minimum time between two codes being requested for the same
// email+business -- without this, someone locked out by
// MAX_FAILED_ATTEMPTS on otp/verify could just request a fresh code
// immediately and keep guessing indefinitely, and this endpoint itself
// could be used to spam someone's inbox with codes.
const RESEND_COOLDOWN_SECONDS = 30;

export async function POST(req: NextRequest) {
  const { email, businessId } = await req.json();

  if (!email || !businessId) {
    return NextResponse.json({ error: "email and businessId are required." }, { status: 400 });
  }

  const { data: recentOtp } = await supabaseAdmin
    .from("booking_otps")
    .select("created_at")
    .eq("email", email.toLowerCase())
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentOtp) {
    const secondsSinceLast =
      (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: "Please wait a moment before requesting another code." },
        { status: 429 }
      );
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate old unused codes for this email + business
  await supabaseAdmin
    .from("booking_otps")
    .update({ used: true })
    .eq("email", email.toLowerCase())
    .eq("business_id", businessId)
    .eq("used", false);

  const { error } = await supabaseAdmin.from("booking_otps").insert({
    email: email.toLowerCase(),
    code,
    business_id: businessId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create code." }, { status: 500 });
  }

  try {
    await sendBookingOtpEmail({ to: email, code });
  } catch {
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
