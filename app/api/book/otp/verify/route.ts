import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// After this many wrong guesses against one code, it's locked out --
// the customer has to request a fresh one (otp/send). Caps brute-force
// attempts against any single 6-digit code to a handful of tries instead
// of the full ~900,000-combination search space.
const MAX_FAILED_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const { email, code, businessId } = await req.json();

  if (!email || !code || !businessId) {
    return NextResponse.json({ error: "email, code, and businessId are required." }, { status: 400 });
  }

  // Look up the currently-active code for this email+business by identity
  // (not by code match) so a wrong guess can still be counted against it --
  // otp/send always invalidates any previous unused code, so there's at
  // most one active row here.
  const { data: otp } = await supabaseAdmin
    .from("booking_otps")
    .select("id, code, expires_at, used, failed_attempts")
    .eq("email", email.toLowerCase())
    .eq("business_id", businessId)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  if (otp.failed_attempts >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Please request a new code." },
      { status: 429 }
    );
  }

  if (new Date(otp.expires_at) < new Date()) {
    return NextResponse.json({ error: "This code has expired. Please request a new one." }, { status: 400 });
  }

  if (otp.code !== code) {
    await supabaseAdmin
      .from("booking_otps")
      .update({ failed_attempts: otp.failed_attempts + 1 })
      .eq("id", otp.id);

    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  // Mark used
  await supabaseAdmin
    .from("booking_otps")
    .update({ used: true })
    .eq("id", otp.id);

  // Look up existing customer for this business by email
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, name, phone")
    .eq("business_id", businessId)
    .eq("email", email.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();

  let pets: { id: string; name: string; breed: string | null }[] = [];
  if (customer) {
    const { data: petData } = await supabaseAdmin
      .from("pets")
      .select("id, name, breed")
      .eq("customer_id", customer.id)
      .eq("is_active", true)
      .order("name");
    pets = petData ?? [];
  }

  return NextResponse.json({
    verified: true,
    // Proof this email was actually verified -- /api/book/request requires
    // this id (matched against a used=true row for the same email+business)
    // before it'll accept a submission, so the booking form can't be POSTed
    // to directly without ever completing the OTP step.
    otpId: otp.id,
    customer: customer
      ? { id: customer.id, name: customer.name, phone: customer.phone }
      : null,
    pets,
  });
}
