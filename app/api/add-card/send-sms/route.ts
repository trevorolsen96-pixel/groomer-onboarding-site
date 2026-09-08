import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendSms } from "../../../../lib/telnyx";
import { normalizeSmsText } from "../../../../lib/sms-text";
import { logOutboundSmsToConversation } from "../../../../lib/sms-conversation-log";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return `+1${digits}`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await request.json();
    const customerId = String(body.customerId ?? "").trim();
    const businessId = String(body.businessId ?? "").trim();
    const cardUrl = String(body.cardUrl ?? "").trim();

    if (!customerId || !businessId || !cardUrl) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
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
      .select("phone_number, status")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!smsSetup || !["active", "approved"].includes(smsSetup.status ?? "") || !smsSetup.phone_number) {
      return NextResponse.json({ error: "SMS is not activated for this business." }, { status: 400 });
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("name, phone, image_url")
      .eq("id", customerId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!customer?.phone) {
      return NextResponse.json({ error: "This customer does not have a phone number." }, { status: 400 });
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);
    const toPhone = normalizePhone(customer.phone);

    const message = normalizeSmsText(`Please save a card on file: ${cardUrl}`);

    await sendSms({ from: fromPhone, to: toPhone, text: message });

    try {
      await logOutboundSmsToConversation({
        businessId,
        customerId,
        customerName: (customer.name as string | null) ?? "Client",
        customerPhone: customer.phone,
        customerImageUrl: customer.image_url,
        body: message,
      });
    } catch (usageLogError) {
      console.error("Failed to log card-on-file SMS usage:", usageLogError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send card-on-file link." },
      { status: 500 }
    );
  }
}
