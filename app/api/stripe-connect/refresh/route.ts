import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "No business profile found." }, { status: 403 });
    }

    const businessId = profile.business_id as string;

    const { data: paymentSettings } = await supabaseAdmin
      .from("business_payment_settings")
      .select("stripe_connected_account_id")
      .eq("business_id", businessId)
      .maybeSingle();

    const accountId = String(paymentSettings?.stripe_connected_account_id ?? "").trim();

    if (!accountId) {
      return NextResponse.json({
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        payments_enabled: false,
        status: "not_connected",
      });
    }

    // Fetch real status from Stripe
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      }
    );

    const account = await stripeRes.json();

    if (!stripeRes.ok) {
      throw new Error(account?.error?.message ?? "Unable to retrieve Stripe account.");
    }

    const chargesEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;
    const detailsSubmitted = account.details_submitted === true;
    const paymentsEnabled = chargesEnabled && payoutsEnabled && detailsSubmitted;

    const status = paymentsEnabled
      ? "active"
      : detailsSubmitted
      ? "pending"
      : "needs_onboarding";

    // Update DB with real status
    await supabaseAdmin
      .from("business_payment_settings")
      .update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        connect_onboarding_complete: detailsSubmitted,
        payments_enabled: paymentsEnabled,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    return NextResponse.json({
      connected: true,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      payments_enabled: paymentsEnabled,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to refresh Stripe status." },
      { status: 500 }
    );
  }
}
