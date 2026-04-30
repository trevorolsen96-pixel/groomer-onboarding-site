import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

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

function buildSubscriptionUpdateData(subscription: Stripe.Subscription) {
  const sub = subscription as StripeSubscriptionWithPeriods;
  const { currentPeriodStart, currentPeriodEnd } = getCurrentPeriod(sub);
  const customerId = getCustomerId(sub);
  const appAccessStatus = getAppAccessStatus(sub);

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
  };
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  options?: {
    businessId?: string | null;
  }
) {
  const sub = subscription as StripeSubscriptionWithPeriods;
  const customerId = getCustomerId(sub);
  const updateData = buildSubscriptionUpdateData(subscription);

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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const billingAction = session.metadata?.billing_action ?? null;
  const businessId = session.metadata?.business_id ?? null;

  if (billingAction !== "reactivate") {
    return;
  }

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

  await syncSubscription(subscription, {
    businessId,
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