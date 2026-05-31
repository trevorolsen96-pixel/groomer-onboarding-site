import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { email, code, businessId } = await req.json();

  if (!email || !code || !businessId) {
    return NextResponse.json({ error: "email, code, and businessId are required." }, { status: 400 });
  }

  const { data: otp } = await supabaseAdmin
    .from("booking_otps")
    .select("id, expires_at, used")
    .eq("email", email.toLowerCase())
    .eq("code", code)
    .eq("business_id", businessId)
    .eq("used", false)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  if (new Date(otp.expires_at) < new Date()) {
    return NextResponse.json({ error: "This code has expired. Please request a new one." }, { status: 400 });
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
    customer: customer
      ? { id: customer.id, name: customer.name, phone: customer.phone }
      : null,
    pets,
  });
}
