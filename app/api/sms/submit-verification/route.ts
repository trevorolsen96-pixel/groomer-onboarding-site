import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio environment variables are missing.");
  }

  return twilio(accountSid, authToken);
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
      smsSetup.twilio_phone_number_sid &&
      ["number_assigned", "pending", "approved"].includes(smsSetup.status)
    ) {
      return NextResponse.json({
        ok: true,
        phoneNumber: smsSetup.phone_number,
        phoneNumberSid: smsSetup.twilio_phone_number_sid,
        status: smsSetup.status,
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
        .select("*")
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

    const twilioClient = getTwilioClient();

    const availableNumbers = await twilioClient
      .availablePhoneNumbers("US")
      .tollFree.list({
        smsEnabled: true,
        limit: 1,
      });

    const selectedNumber = availableNumbers[0]?.phoneNumber;

    if (!selectedNumber) {
      await markSmsSetupFailed(
        safeBusinessId,
        "No toll-free SMS numbers were available from Twilio."
      );

      return NextResponse.json(
        {
          error:
            "Messaging setup could not be completed. Please contact support@wagzly.com.",
        },
        { status: 400 }
      );
    }

    const friendlyName = `Wagzly - ${cleanText(
      verificationProfile.dba_name ||
        verificationProfile.legal_business_name ||
        "Business"
    )}`.slice(0, 64);

    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber,
      friendlyName,
    });

    const { error: updateError } = await supabaseAdmin
      .from("business_sms_setup")
      .update({
        status: "number_assigned",
        phone_number: purchasedNumber.phoneNumber,
        twilio_phone_number_sid: purchasedNumber.sid,
        failure_reason: null,
        updated_at: new Date().toISOString(),
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

    return NextResponse.json({
      ok: true,
      phoneNumber: purchasedNumber.phoneNumber,
      phoneNumberSid: purchasedNumber.sid,
      status: "number_assigned",
    });
  } catch (error) {
    if (businessId) {
      await markSmsSetupFailed(
        businessId,
        error instanceof Error ? error.message : "Unknown Twilio setup error."
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