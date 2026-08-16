import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendPushToBusinessAsync } from "../../../../lib/push-notification";

// Handles events for connected Stripe accounts -- specifically, completed
// checkouts for appointment payment links. app/api/pay/create-session
// creates those checkout sessions directly on a business's connected
// account (via the Stripe-Account header), so the resulting events are
// Connect-scoped and only ever arrive at a Connect-configured webhook --
// they do NOT show up at /api/stripe/webhook, which only receives
// platform-level events (Wagzly's own subscription billing).
//
// This closes a real gap found in a security audit: previously NOTHING
// ever marked appointment_payment_links.status = 'paid' or recorded a
// completed online payment into appointment_payments at all. As a result:
// (a) the same payment link could be paid multiple times -- the "already
// paid" guards in create-session/route.ts and the /pay/[id] page existed
// in the code but never actually fired, and (b) a business's own app
// never learned an online payment happened unless the groomer noticed and
// recorded it manually.
//
// Setup required in the Stripe Dashboard before this actually does
// anything: Developers -> Webhooks -> Add endpoint ->
// https://www.wagzly.com/api/stripe/connect-webhook, toggle "Listen to
// events on Connected accounts", subscribe to checkout.session.completed,
// then set the resulting signing secret as STRIPE_CONNECT_WEBHOOK_SECRET
// in Vercel. Until that's done this route can't verify anything and just
// returns 500 -- it fails safely rather than silently, and doesn't touch
// anything that already works today (Connect events simply never reach
// Wagzly at all without that dashboard configuration).
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn(
      "[stripe-connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set -- " +
        "this endpoint can't verify or process any events yet. Add a Connect " +
        "webhook endpoint in the Stripe Dashboard and set this env var in Vercel."
    );
    return NextResponse.json(
      { error: "Connect webhook is not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
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
    if (event.type === "checkout.session.completed") {
      await handleConnectCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        (event as Stripe.Event & { account?: string }).account ?? null
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-connect-webhook] handler error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler error." },
      { status: 500 }
    );
  }
}

async function handleConnectCheckoutCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null
) {
  const paymentLinkId = session.metadata?.payment_link_id ?? null;
  if (!paymentLinkId) {
    // Not one of ours (or an older session created before this metadata
    // field existed) -- nothing to reconcile.
    return;
  }

  const { data: link, error: linkError } = await supabaseAdmin
    .from("appointment_payment_links")
    .select(
      "id, business_id, appointment_id, amount, tip_amount, stripe_connected_account_id, status"
    )
    .eq("id", paymentLinkId)
    .maybeSingle();

  if (linkError || !link) {
    console.error("[stripe-connect-webhook] payment link not found:", paymentLinkId);
    return;
  }

  // Sanity check: the event's connected account should match the one this
  // link was actually created on -- stops a stray/forged metadata value on
  // some other account's session from marking a different business's link
  // as paid.
  if (connectedAccountId && link.stripe_connected_account_id !== connectedAccountId) {
    console.error(
      "[stripe-connect-webhook] connected account mismatch for payment link",
      paymentLinkId
    );
    return;
  }

  if (link.status === "paid") {
    // Already processed -- Stripe retries webhook deliveries, so this must
    // be a safe no-op rather than inserting a duplicate payment record.
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const now = new Date().toISOString();

  await supabaseAdmin
    .from("appointment_payment_links")
    .update({
      status: "paid",
      paid_at: now,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", link.id);

  await supabaseAdmin.from("appointment_payments").insert({
    business_id: link.business_id,
    appointment_id: link.appointment_id,
    amount: link.amount,
    tip_amount: link.tip_amount ?? 0,
    payment_method: "stripe",
    note: "Paid online via payment link",
    paid_at: now,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_connected_account_id: link.stripe_connected_account_id,
  });

  const total = Number(link.amount ?? 0) + Number(link.tip_amount ?? 0);

  await sendPushToBusinessAsync({
    businessId: link.business_id,
    title: "Payment Received",
    body: `A client paid $${total.toFixed(2)} online.`,
    data: {
      type: "payment_received",
      route: "schedule",
      appointmentId: link.appointment_id,
    },
  });
}
