import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = cleanText(body.fullName);
    const businessName = cleanText(body.businessName);
    const phone = cleanText(body.phone);
    const email = cleanText(body.email).toLowerCase();
    const password = cleanText(body.password);
    const acceptedTerms = body.acceptedTerms === true;

    if (!fullName) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    }

    if (!businessName) {
      return NextResponse.json({ error: "Enter your business name." }, { status: 400 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "You must accept the Terms and Privacy Policy." },
        { status: 400 }
      );
    }

    const trialStartsAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          business_name: businessName,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Unable to create account." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        owner_user_id: userId,
        subscription_status: "trialing",
        trial_starts_at: trialStartsAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        plan: "basic",
      })
      .select("id")
      .single();

    if (businessError || !business) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: businessError?.message ?? "Unable to create business." },
        { status: 400 }
      );
    }

    const businessId = business.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      business_id: businessId,
      full_name: fullName,
      role: "admin",
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    const { error: settingsError } = await supabaseAdmin
      .from("business_settings")
      .insert({
        business_id: businessId,
        business_mode: "mobile_grooming",
        business_name: businessName,
        phone: phone || null,
        sms_enabled: false,
        reschedule_sms_enabled: false,
        default_customer_sms_mode: "enabled",
        sms_timezone: "America/Los_Angeles",
        ask_confirmation_day_before: false,
      });

    if (settingsError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: settingsError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      businessId,
      trialEndsAt: trialEndsAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}