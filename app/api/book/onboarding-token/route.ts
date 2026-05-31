import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const { businessId, clientEmail, clientName } = await req.json();

  if (!businessId || !clientEmail) {
    return NextResponse.json({ error: "businessId and clientEmail are required." }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");

  const { error } = await supabaseAdmin.from("onboarding_requests").insert({
    business_id: businessId,
    token,
    status: "pending",
    source: "booking",
    client_email: clientEmail,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create onboarding token." }, { status: 500 });
  }

  return NextResponse.json({ token });
}
