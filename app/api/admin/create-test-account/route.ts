import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { verifyCronRequest } from "../../../../lib/cron-auth";

// One-off/occasional admin tool -- creates a fully-usable business account
// (auth user + businesses/profiles/business_settings/business_sms_setup
// rows), bypassing Stripe checkout entirely. Mirrors the account shape
// the Stripe webhook creates on a real signup (see
// app/api/stripe/webhook/route.ts) minus payment fields, so features like
// the data importers behave exactly as they would for a real customer.
// Reuses CRON_SECRET auth like broadcast-announcement, since this is
// meant to be triggered manually by us, not exposed publicly -- there's
// no payment gate here, so anyone who could call this could mint free
// accounts.
export async function POST(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const businessName = String(body.businessName ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!businessName || !fullName || !email || password.length < 8) {
      return NextResponse.json(
        { error: "businessName, fullName, email, and a password (8+ chars) are required." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, business_name: businessName },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: authError?.message?.toLowerCase().includes("already")
            ? "An account with this email already exists."
            : authError?.message ?? "Unable to create user.",
        },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: businessName,
        owner_user_id: userId,
        // 'active' rather than 'trialing' -- no cron job should ever have
        // a reason to touch this account's access.
        subscription_status: "active",
        app_access_status: "active",
        cancel_at_period_end: false,
        plan: "pro",
        last_payment_status: "active",
      })
      .select("id")
      .single();

    if (businessError || !business) {
      throw new Error(businessError?.message ?? "Unable to create business.");
    }

    const businessId = business.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      { id: userId, business_id: businessId, full_name: fullName, role: "admin" },
      { onConflict: "id" }
    );
    if (profileError) throw new Error(profileError.message);

    const { error: settingsError } = await supabaseAdmin.from("business_settings").upsert(
      {
        business_id: businessId,
        business_mode: "mobile_grooming",
        business_name: businessName,
        phone: phone || null,
        sms_enabled: false,
        reschedule_sms_enabled: false,
        default_customer_sms_mode: "enabled",
        sms_timezone: null,
        ask_confirmation_day_before: false,
      },
      { onConflict: "business_id" }
    );
    if (settingsError) throw new Error(settingsError.message);

    const { error: smsSetupError } = await supabaseAdmin.from("business_sms_setup").upsert(
      { business_id: businessId, status: "needs_info" },
      { onConflict: "business_id" }
    );
    if (smsSetupError) throw new Error(smsSetupError.message);

    return NextResponse.json({
      ok: true,
      businessId,
      userId,
      email,
      note: "Log in at wagzly.com (or the app) with this email and the password you supplied.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create test account." },
      { status: 500 }
    );
  }
}
