import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const ALLOWED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

async function getAuthenticatedBusinessId(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Missing auth token.");

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("business_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Profile not found.");
  if (profile.role !== "admin") {
    throw new Error("Only an account admin can edit the business profile.");
  }

  return profile.business_id as string;
}

export async function PATCH(request: Request) {
  try {
    const businessId = await getAuthenticatedBusinessId(request);
    const body = await request.json();

    const businessName =
      typeof body.businessName === "string" ? body.businessName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const website = typeof body.website === "string" ? body.website.trim() : "";
    const smsTimezone =
      typeof body.smsTimezone === "string" ? body.smsTimezone.trim() : "";
    const smsEnabled = Boolean(body.smsEnabled);

    if (!businessName) {
      return NextResponse.json(
        { error: "Business name can't be empty." },
        { status: 400 }
      );
    }
    if (businessName.length > 200) {
      return NextResponse.json(
        { error: "Business name is too long." },
        { status: 400 }
      );
    }
    if (website && /\s/.test(website)) {
      return NextResponse.json(
        { error: "Website doesn't look like a valid URL." },
        { status: 400 }
      );
    }
    if (smsTimezone && !ALLOWED_TIMEZONES.includes(smsTimezone)) {
      return NextResponse.json(
        { error: "Unrecognized timezone." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("business_settings")
      .update({
        business_name: businessName,
        phone: phone || null,
        website: website || null,
        sms_timezone: smsTimezone,
        sms_enabled: smsEnabled,
      })
      .eq("business_id", businessId)
      .select(
        "business_id, business_name, phone, website, business_mode, sms_enabled, sms_timezone"
      )
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to save business profile.");
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save business profile.",
      },
      { status: 400 }
    );
  }
}
