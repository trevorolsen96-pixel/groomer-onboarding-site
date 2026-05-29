import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/telnyx";

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

export async function POST(request: NextRequest) {
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
    const toPhone = normalizePhone(cleanText(body.phone));
    const staffName = cleanText(body.staffName);
    const inviteLink = cleanText(body.link);

    if (!businessId || !toPhone || !inviteLink) {
      return NextResponse.json(
        { error: "Missing invite details." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: smsSetup, error: smsSetupError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      smsSetupError ||
      !smsSetup ||
      !["active", "approved"].includes(smsSetup.status ?? "") ||
      !smsSetup.phone_number
    ) {
      return NextResponse.json(
        { error: "sms_not_activated" },
        { status: 400 }
      );
    }

    const fromPhone = normalizePhone(smsSetup.phone_number);

    await sendSms({
      from: fromPhone,
      to: toPhone,
      text: `Hi ${staffName || "there"}, you have been invited to join Wagzly. Create your staff account here: ${inviteLink}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send invite.",
      },
      { status: 400 }
    );
  }
}
