import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendPasswordSetupEmail } from "../../../../lib/email";

type StripeSubscriptionItemWithPeriods = Stripe.SubscriptionItem & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

function toIsoFromUnix(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function getCurrentPeriod(subscription: StripeSubscriptionWithPeriods) {
  const firstItem = subscription.items.data[0] as
    | StripeSubscriptionItemWithPeriods
    | undefined;

  return {
    currentPeriodStart:
      firstItem?.current_period_start ??
      subscription.current_period_start ??
      null,
    currentPeriodEnd:
      firstItem?.current_period_end ?? subscription.current_period_end ?? null,
  };
}

function getAppAccessStatus(subscription: StripeSubscriptionWithPeriods) {
  if (subscription.status === "trialing") return "trialing";
  if (subscription.status === "active") return "active";
  if (subscription.status === "past_due") return "past_due";

  if (subscription.status === "canceled") {
    return "blocked";
  }

  if (subscription.status === "unpaid") {
    return "past_due";
  }

  return "blocked";
}

function getCustomerId(subscription: StripeSubscriptionWithPeriods) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function getPlanFromSubscription(subscription: Stripe.Subscription): string | null {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const basicPriceId = process.env.STRIPE_BASIC_PRICE_ID;
  const items = subscription.items.data;

  if (proPriceId && items.some((i) => i.price.id === proPriceId)) return "pro";
  if (basicPriceId && items.some((i) => i.price.id === basicPriceId)) return "basic";
  return null;
}

function buildSubscriptionUpdateData(subscription: Stripe.Subscription) {
  const sub = subscription as StripeSubscriptionWithPeriods;
  const { currentPeriodStart, currentPeriodEnd } = getCurrentPeriod(sub);
  const customerId = getCustomerId(sub);
  const appAccessStatus = getAppAccessStatus(sub);
  const plan = getPlanFromSubscription(subscription);

  return {
    subscription_status: sub.status,
    app_access_status: appAccessStatus,
    trial_starts_at: toIsoFromUnix(sub.trial_start),
    trial_ends_at: toIsoFromUnix(sub.trial_end),
    current_period_starts_at: toIsoFromUnix(currentPeriodStart),
    current_period_ends_at: toIsoFromUnix(currentPeriodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: toIsoFromUnix(sub.canceled_at),
    app_access_grace_until: null,
    payment_provider: "stripe",
    payment_customer_id: customerId,
    payment_subscription_id: sub.id,
    last_payment_status:
      sub.status === "active"
        ? "paid"
        : sub.status === "trialing"
          ? "trialing"
          : sub.status,
    ...(plan ? { plan } : {}),
  };
}

function getCreditPackCount(subscription: Stripe.Subscription): number {
  const creditPackPriceId = process.env.STRIPE_SMS_CREDIT_PACK_PRICE_ID;
  if (!creditPackPriceId) return 0;

  const item = subscription.items.data.find(
    (i) => i.price.id === creditPackPriceId
  );
  return item?.quantity ?? 0;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  options?: {
    businessId?: string | null;
  }
) {
  const sub = subscription as StripeSubscriptionWithPeriods;
  const customerId = getCustomerId(sub);
  const updateData = {
    ...buildSubscriptionUpdateData(subscription),
    sms_credit_packs: getCreditPackCount(subscription),
  };

  if (options?.businessId) {
    await supabaseAdmin
      .from("businesses")
      .update(updateData)
      .eq("id", options.businessId);

    return;
  }

  const bySubscription = await supabaseAdmin
    .from("businesses")
    .update(updateData)
    .eq("payment_subscription_id", sub.id)
    .select("id");

  if (bySubscription.error) {
    throw bySubscription.error;
  }

  if ((bySubscription.data ?? []).length > 0) {
    return;
  }

  await supabaseAdmin
    .from("businesses")
    .update(updateData)
    .eq("payment_customer_id", customerId);
}

async function handleNewSignup(
  session: Stripe.Checkout.Session,
  pendingSignupId: string
) {
  const { data: pendingSignup, error: pendingError } = await supabaseAdmin
    .from("pending_business_signups")
    .select("*")
    .eq("id", pendingSignupId)
    .maybeSingle();

  if (pendingError || !pendingSignup) {
    console.error("Pending signup not found", { pendingSignupId, sessionId: session.id });
    return;
  }

  // Idempotency: already processed
  if (pendingSignup.status === "completed") {
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ??
        pendingSignup.stripe_customer_id ??
        null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  if (!stripeCustomerId || !subscriptionId) {
    console.error("Missing Stripe IDs for new signup", { pendingSignupId, sessionId: session.id });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const sub = subscription as StripeSubscriptionWithPeriods;
  const { currentPeriodStart, currentPeriodEnd } = getCurrentPeriod(sub);

  const trialStartsAt =
    toIsoFromUnix(sub.trial_start) ?? new Date().toISOString();
  const trialEndsAt =
    toIsoFromUnix(sub.trial_end) ??
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // --- Create Supabase user (no password — they will set it via the email link) ---
  let userId: string;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: pendingSignup.email,
      email_confirm: true,
      user_metadata: {
        full_name: pendingSignup.full_name,
        business_name: pendingSignup.business_name,
      },
    });

  if (authError) {
    // If user already exists (webhook fired twice), find the existing user
    if (authError.message.toLowerCase().includes("already")) {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const existing = userList?.users.find(
        (u) => u.email?.toLowerCase() === pendingSignup.email.toLowerCase()
      );
      if (!existing) {
        console.error("Cannot find or create user for new signup", { email: pendingSignup.email });
        return;
      }
      userId = existing.id;
    } else {
      console.error("Failed to create user for new signup", { error: authError.message });
      return;
    }
  } else {
    userId = authData.user.id;
  }

  // --- Create business (idempotent: check first) ---
  let businessId: string;

  const { data: existingBusiness } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existingBusiness) {
    businessId = existingBusiness.id;
  } else {
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: pendingSignup.business_name,
        owner_user_id: userId,
        subscription_status: "trialing",
        app_access_status: "trialing",
        trial_starts_at: trialStartsAt,
        trial_ends_at: trialEndsAt,
        current_period_starts_at: toIsoFromUnix(currentPeriodStart),
        current_period_ends_at: toIsoFromUnix(currentPeriodEnd),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        payment_provider: "stripe",
        payment_customer_id: stripeCustomerId,
        payment_subscription_id: subscriptionId,
        last_payment_status: "trialing",
        plan: pendingSignup.selected_plan ?? "basic",
      })
      .select("id")
      .single();

    if (businessError || !business) {
      console.error("Failed to create business for new signup", { error: businessError?.message });
      return;
    }

    businessId = business.id;
  }

  // --- Profile ---
  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      business_id: businessId,
      full_name: pendingSignup.full_name,
      role: "admin",
    },
    { onConflict: "id" }
  );

  // --- Business settings ---
  await supabaseAdmin.from("business_settings").upsert(
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

  // --- SMS setup ---
  await supabaseAdmin.from("business_sms_setup").upsert(
    {
      business_id: businessId,
      status: "needs_info",
    },
    { onConflict: "business_id" }
  );

  // --- Generate password setup link ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wagzly.com";

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: pendingSignup.email,
      options: {
        redirectTo: `${siteUrl}/create-account/set-password`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Failed to generate password setup link", {
      error: linkError?.message,
      pendingSignupId,
    });
    return;
  }

  // --- Send the email ---
  try {
    await sendPasswordSetupEmail({
      to: pendingSignup.email,
      name: pendingSignup.full_name,
      setupUrl: linkData.properties.action_link,
    });
  } catch (emailError) {
    console.error("Failed to send password setup email", {
      error: emailError instanceof Error ? emailError.message : emailError,
      pendingSignupId,
    });
    // Don't return — mark as completed so we don't retry infinitely.
    // The resend endpoint can be used to re-send.
  }

  // --- Mark signup as completed ---
  await supabaseAdmin
    .from("pending_business_signups")
    .update({
      status: "completed",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscriptionId,
      created_business_id: businessId,
      created_user_id: userId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", pendingSignup.id);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const billingAction = session.metadata?.billing_action ?? null;
  const pendingSignupId = session.metadata?.pending_signup_id ?? null;

  if (billingAction === "reactivate") {
    const businessId = session.metadata?.business_id ?? null;

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (!businessId || !subscriptionId) {
      console.error("Missing reactivation checkout data", {
        businessId,
        subscriptionId,
        sessionId: session.id,
      });
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription, { businessId });
    return;
  }

  if (pendingSignupId) {
    await handleNewSignup(session, pendingSignupId);
    return;
  }

  console.warn("checkout.session.completed: unrecognized session type", {
    sessionId: session.id,
    billingAction,
  });
}

async function markPaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  const subscriptionId =
    typeof invoiceWithSubscription.subscription === "string"
      ? invoiceWithSubscription.subscription
      : invoiceWithSubscription.subscription?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription);

  await supabaseAdmin
    .from("businesses")
    .update({
      last_payment_status: "paid",
      app_access_status:
        subscription.status === "trialing" ? "trialing" : "active",
      subscription_status: subscription.status,
      app_access_grace_until: null,
    })
    .eq("payment_subscription_id", subscriptionId);
}

async function markPaymentFailed(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  const subscriptionId =
    typeof invoiceWithSubscription.subscription === "string"
      ? invoiceWithSubscription.subscription
      : invoiceWithSubscription.subscription?.id ?? null;

  if (!subscriptionId) return;

  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 3);

  await supabaseAdmin
    .from("businesses")
    .update({
      subscription_status: "past_due",
      app_access_status: "past_due",
      app_access_grace_until: graceUntil.toISOString(),
      last_payment_status: "failed",
    })
    .eq("payment_subscription_id", subscriptionId);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Webhook signature verification failed: ${error.message}`
            : "Webhook signature verification failed.",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabaseAdmin
          .from("businesses")
          .update({
            subscription_status: "canceled",
            app_access_status: "blocked",
            cancel_at_period_end: false,
            canceled_at: new Date().toISOString(),
            app_access_grace_until: null,
            last_payment_status: "canceled",
          })
          .eq("payment_subscription_id", subscription.id);

        break;
      }

      case "invoice.payment_succeeded": {
        await markPaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      }

      case "invoice.payment_failed": {
        await markPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook handler failed.",
      },
      { status: 500 }
    );
  }
}
