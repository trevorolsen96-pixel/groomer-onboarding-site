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

export async function POST(request: Request) {
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

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const businessId = profile.business_id;

    const { data: smsSetup, error: setupError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (setupError || !smsSetup) {
      return NextResponse.json(
        { error: "Messaging setup was not found." },
        { status: 400 }
      );
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
        .eq("business_id", businessId)
        .maybeSingle();

    if (verificationProfileError || !verificationProfile) {
      return NextResponse.json(
        { error: "Verification profile is missing." },
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
      return NextResponse.json(
        { error: "No toll-free SMS numbers are currently available." },
        { status: 400 }
      );
    }

    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber,
      friendlyName: `Wagzly - ${cleanText(
        verificationProfile.dba_name || verificationProfile.legal_business_name
      )}`,
    });

    const { error: updateError } = await supabaseAdmin
      .from("business_sms_setup")
      .update({
        status: "number_assigned",
        phone_number: purchasedNumber.phoneNumber,
        twilio_phone_number_sid: purchasedNumber.sid,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      phoneNumber: purchasedNumber.phoneNumber,
      phoneNumberSid: purchasedNumber.sid,
      status: "number_assigned",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit messaging verification.",
      },
      { status: 400 }
    );
  }
}