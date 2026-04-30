import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoFromUnix(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let businessId: string | null = null;

  try {
    const body = await request.json();

    const sessionId = cleanText(body.sessionId);
    const password = cleanText(body.password);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing Stripe checkout session." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.status !== "complete") {
      return NextResponse.json(
        { error: "Checkout is not complete yet." },
        { status: 400 }
      );
    }

    const { data: pendingSignup, error: pendingError } = await supabaseAdmin
      .from("pending_business_signups")
      .select("*")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (pendingError || !pendingSignup) {
      return NextResponse.json(
        { error: "Unable to find your completed signup." },
        { status: 400 }
      );
    }

    if (pendingSignup.status === "completed" && pendingSignup.created_business_id) {
      return NextResponse.json({
        ok: true,
        email: pendingSignup.email,
        businessId: pendingSignup.created_business_id,
      });
    }

    const subscription =
      typeof session.subscription === "string"
        ? null
        : (session.subscription as Stripe.Subscription | null);

    const stripeCustomerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? pendingSignup.stripe_customer_id ?? null;

    const stripeSubscriptionId =
      subscription?.id ??
      (typeof session.subscription === "string" ? session.subscription : null);

    if (!stripeCustomerId || !stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Stripe subscription details are missing." },
        { status: 400 }
      );
    }

    const trialStartsAt =
      toIsoFromUnix(subscription?.trial_start) ?? new Date().toISOString();

    const trialEndsAt =
      toIsoFromUnix(subscription?.trial_end) ??
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const subscriptionWithPeriods = subscription as
  | (Stripe.Subscription & {
      current_period_start?: number | null;
      current_period_end?: number | null;
    })
  | null;

const currentPeriodStartsAt = toIsoFromUnix(
  subscriptionWithPeriods?.current_period_start
);

const currentPeriodEndsAt = toIsoFromUnix(
  subscriptionWithPeriods?.current_period_end
);

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: pendingSignup.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: pendingSignup.full_name,
          business_name: pendingSignup.business_name,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message?.toLowerCase().includes("already")
              ? "An account with this email already exists. Please log in instead."
              : authError?.message ?? "Unable to create your account.",
        },
        { status: 400 }
      );
    }

    userId = authData.user.id;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: pendingSignup.business_name,
        owner_user_id: userId,
        subscription_status: "trialing",
        app_access_status: "trialing",
        trial_starts_at: trialStartsAt,
        trial_ends_at: trialEndsAt,
        current_period_starts_at: currentPeriodStartsAt,
        current_period_ends_at: currentPeriodEndsAt,
        cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
        payment_provider: "stripe",
        payment_customer_id: stripeCustomerId,
        payment_subscription_id: stripeSubscriptionId,
        last_payment_status: "trialing",
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
          full_name: pendingSignup.full_name,
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
          business_name: pendingSignup.business_name,
          phone: pendingSignup.phone || null,
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

    const { error: pendingUpdateError } = await supabaseAdmin
      .from("pending_business_signups")
      .update({
        status: "completed",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        created_business_id: businessId,
        created_user_id: userId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", pendingSignup.id);

    if (pendingUpdateError) {
      throw new Error(pendingUpdateError.message);
    }

    return NextResponse.json({
      ok: true,
      email: pendingSignup.email,
      businessId,
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
            : "Something went wrong finishing your account.",
      },
      { status: 400 }
    );
  }
}