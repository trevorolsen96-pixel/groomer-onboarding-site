import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { searchAvailableNumber, purchasePhoneNumber } from "@/lib/telnyx";

// purchasePhoneNumber retries 10DLC campaign assignment a few times
// (~9s) before giving up for this request -- give the function enough
// runway so Vercel doesn't cut it off mid-retry.
export const maxDuration = 30;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business account was not found." },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("business_sms_setup")
      .select("status, phone_number")
      .eq("business_id", businessId)
      .maybeSingle();

    if (
      existing?.phone_number &&
      ["active", "approved"].includes(existing.status ?? "")
    ) {
      return NextResponse.json({
        ok: true,
        phoneNumber: existing.phone_number,
        status: "active",
      });
    }

    const body = await request.json().catch(() => ({}));
    const rawAreaCode = cleanText(body.areaCode).replace(/\D/g, "").slice(0, 3);

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("plan")
      .eq("id", businessId)
      .maybeSingle();

    const isPro = (business?.plan ?? "basic").toLowerCase() === "pro";
    const areaCode = isPro && rawAreaCode ? rawAreaCode : undefined;

    if (areaCode && areaCode.length !== 3) {
      return NextResponse.json(
        { error: "Area code must be exactly 3 digits." },
        { status: 400 }
      );
    }

    // Deliberately does NOT fall back to a random area code when the
    // requested one has no availability — the whole point of asking is to
    // guarantee a local number, so silently substituting a different area
    // code would defeat that. The user picks a different code instead.
    const phoneNumber = await searchAvailableNumber(areaCode);

    if (!phoneNumber) {
      return NextResponse.json(
        {
          error: areaCode
            ? `No phone numbers are available in area code ${areaCode} right now. Try a different area code.`
            : "No phone numbers are available right now. Please try again later.",
        },
        { status: 400 }
      );
    }

    const purchased = await purchasePhoneNumber(phoneNumber);
    const now = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("business_sms_setup")
      .upsert(
        {
          business_id: businessId,
          status: "active",
          phone_number: purchased.phoneNumber,
          telnyx_phone_number_id: purchased.id,
          failure_reason: null,
          submitted_at: now,
          approved_at: now,
          created_at: now,
          updated_at: now,
          campaign_assigned_at: purchased.campaignAssigned ? now : null,
          campaign_assignment_last_error:
            purchased.campaignAssignmentError ?? null,
        },
        { onConflict: "business_id" }
      );

    if (upsertError) {
      console.error("SMS setup upsert failed:", upsertError);
      throw new Error(`Failed to save SMS setup: ${upsertError.message}`);
    }

    // Turn on the reminder/reschedule toggles automatically now that there's
    // a real number to send from — a business shouldn't have to remember to
    // flip these on themselves right after activating.
    await supabaseAdmin
      .from("business_settings")
      .update({
        sms_sender_number: purchased.phoneNumber,
        sms_enabled: true,
        reschedule_sms_enabled: true,
      })
      .eq("business_id", businessId);

    return NextResponse.json({
      ok: true,
      phoneNumber: purchased.phoneNumber,
      status: "active",
    });
  } catch (error) {
    if (businessId) {
      await supabaseAdmin
        .from("business_sms_setup")
        .upsert(
          {
            business_id: businessId,
            status: "failed",
            failure_reason:
              error instanceof Error
                ? error.message
                : "Unknown activation error.",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" }
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "SMS activation failed. Please try again.",
      },
      { status: 400 }
    );
  }
}
