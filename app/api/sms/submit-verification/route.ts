import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { searchAvailableNumber, purchasePhoneNumber } from "../../../../lib/telnyx";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function markSmsSetupFailed(businessId: string, reason: string) {
  await supabaseAdmin
    .from("business_sms_setup")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);
}

export async function POST(request: Request) {
  let businessId: string | null = null;

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business account was not found." },
        { status: 400 }
      );
    }

    const safeBusinessId = businessId;

    const { data: smsSetup, error: setupError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("*")
      .eq("business_id", safeBusinessId)
      .maybeSingle();

    if (setupError || !smsSetup) {
      return NextResponse.json(
        { error: "Messaging setup was not found." },
        { status: 400 }
      );
    }

    if (
      smsSetup.phone_number &&
      smsSetup.telnyx_phone_number_id &&
      ["active", "approved"].includes(smsSetup.status ?? "")
    ) {
      return NextResponse.json({
        ok: true,
        phoneNumber: smsSetup.phone_number,
        status: "active",
      });
    }

    if (smsSetup.status !== "ready_to_submit") {
      return NextResponse.json(
        {
          error:
            "Messaging setup is not ready to submit. Current status: " +
            smsSetup.status,
        },
        { status: 400 }
      );
    }

    const { data: verificationProfile, error: verificationProfileError } =
      await supabaseAdmin
        .from("business_sms_verification_profile")
        .select("dba_name, legal_business_name")
        .eq("business_id", safeBusinessId)
        .maybeSingle();

    if (verificationProfileError || !verificationProfile) {
      await markSmsSetupFailed(
        safeBusinessId,
        "Verification profile is missing. Please contact support@wagzly.com."
      );

      return NextResponse.json(
        {
          error:
            "Messaging setup could not be completed. Please contact support@wagzly.com.",
        },
        { status: 400 }
      );
    }

    const phoneNumber = await searchAvailableNumber();

    if (!phoneNumber) {
      await markSmsSetupFailed(
        safeBusinessId,
        "No SMS numbers were available."
      );

      return NextResponse.json(
        {
          error:
            "Messaging setup could not be completed. Please contact support@wagzly.com.",
        },
        { status: 400 }
      );
    }

    const purchased = await purchasePhoneNumber(phoneNumber);
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("business_sms_setup")
      .update({
        status: "active",
        phone_number: purchased.phoneNumber,
        telnyx_phone_number_id: purchased.id,
        failure_reason: null,
        submitted_at: now,
        approved_at: now,
        updated_at: now,
      })
      .eq("business_id", safeBusinessId);

    if (updateError) {
      await markSmsSetupFailed(
        safeBusinessId,
        `Number was purchased but database update failed: ${updateError.message}`
      );

      return NextResponse.json(
        {
          error:
            "Messaging setup could not be completed. Please contact support@wagzly.com.",
        },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from("business_settings")
      .update({ sms_sender_number: purchased.phoneNumber })
      .eq("business_id", safeBusinessId);

    return NextResponse.json({
      ok: true,
      phoneNumber: purchased.phoneNumber,
      status: "active",
    });
  } catch (error) {
    if (businessId) {
      await markSmsSetupFailed(
        businessId,
        error instanceof Error ? error.message : "Unknown activation error."
      );
    }

    return NextResponse.json(
      {
        error:
          "Messaging setup could not be completed. Please contact support@wagzly.com.",
      },
      { status: 400 }
    );
  }
}
