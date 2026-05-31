import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  } = await req.json();

  if (!businessId || !serviceId || !requestedDate || !clientEmail) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!petIds || petIds.length === 0) {
    return NextResponse.json({ error: "At least one pet is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("booking_requests").insert({
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
  });

  if (error) {
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
