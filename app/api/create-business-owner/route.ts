import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let businessId: string | null = null;

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
        {
          error:
            authError?.message?.toLowerCase().includes("already")
              ? "An account with this email already exists. Please log in instead."
              : authError?.message ?? "Unable to create account.",
        },
        { status: 400 }
      );
    }

    userId = authData.user.id;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, business_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.business_id) {
      const { data: existingBusiness } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("id", existingProfile.business_id)
        .maybeSingle();

      if (existingBusiness) {
        return NextResponse.json({
          ok: true,
          businessId: existingProfile.business_id,
          trialEndsAt: trialEndsAt.toISOString(),
        });
      }
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: businessName,
        owner_user_id: userId,
        subscription_status: "trialing",
        trial_starts_at: trialStartsAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        plan: "basic",
      })
      .select("id")
      .single();

    if (businessError || !business) {
      throw new Error(businessError?.message ?? "Unable to create business.");
    }

    businessId = business.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          business_id: businessId,
          full_name: fullName,
          role: "admin",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: settingsError } = await supabaseAdmin
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          business_mode: "mobile_grooming",
          business_name: businessName,
          phone: phone || null,
          sms_enabled: false,
          reschedule_sms_enabled: false,
          default_customer_sms_mode: "enabled",
          sms_timezone: "America/Los_Angeles",
          ask_confirmation_day_before: false,
        },
        { onConflict: "business_id" }
      );

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    return NextResponse.json({
      ok: true,
      businessId,
      trialEndsAt: trialEndsAt.toISOString(),
    });
  } catch (error) {
    if (businessId) {
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);
    }

    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong creating your account.",
      },
      { status: 400 }
    );
  }
}