import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const BASE_URL = "https://www.wagzly.com";

function toMoneyNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentLinkId = String(body.payment_link_id ?? "").trim();
    const tipAmount = Math.max(0, toMoneyNumber(body.tip_amount));

    if (!paymentLinkId) {
      return NextResponse.json({ error: "Missing payment_link_id." }, { status: 400 });
    }

    // Load the payment link record
    const { data: link, error: linkError } = await supabaseAdmin
      .from("appointment_payment_links")
      .select("*")
      .eq("id", paymentLinkId)
      .maybeSingle();

    if (linkError) throw new Error(linkError.message);
    if (!link) return NextResponse.json({ error: "Payment link not found." }, { status: 404 });
    if (link.status === "paid") {
      return NextResponse.json({ error: "This payment has already been paid." }, { status: 400 });
    }

    const balanceDue = toMoneyNumber(link.amount);
    const total = Math.round((balanceDue + tipAmount) * 100) / 100;
    const totalCents = Math.round(total * 100);

    if (totalCents < 50) {
      return NextResponse.json({ error: "Payment amount is too small." }, { status: 400 });
    }

    // Load business info for display
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("name")
      .eq("id", link.business_id)
      .maybeSingle();

    const businessName = String(business?.name ?? "Wagzly Business").trim();

    const successUrl = `${BASE_URL}/pay/${paymentLinkId}/success`;
    const cancelUrl = `${BASE_URL}/pay/${paymentLinkId}`;

    // Create Stripe Checkout session
    const stripeBody = new URLSearchParams();
    stripeBody.set("mode", "payment");
    stripeBody.set("success_url", successUrl);
    stripeBody.set("cancel_url", cancelUrl);

    stripeBody.set("line_items[0][quantity]", "1");
    stripeBody.set("line_items[0][price_data][currency]", "usd");
    stripeBody.set("line_items[0][price_data][unit_amount]", String(Math.round(balanceDue * 100)));
    stripeBody.set("line_items[0][price_data][product_data][name]", `${businessName} — Grooming`);

    if (tipAmount > 0) {
      stripeBody.set("line_items[1][quantity]", "1");
      stripeBody.set("line_items[1][price_data][currency]", "usd");
      stripeBody.set("line_items[1][price_data][unit_amount]", String(Math.round(tipAmount * 100)));
      stripeBody.set("line_items[1][price_data][product_data][name]", "Tip for your groomer");
    }

    stripeBody.set("metadata[business_id]", link.business_id);
    stripeBody.set("metadata[appointment_id]", link.appointment_id);
    stripeBody.set("metadata[payment_link_id]", paymentLinkId);
    stripeBody.set("metadata[tip_amount]", String(tipAmount));
    stripeBody.set("payment_intent_data[metadata][business_id]", link.business_id);
    stripeBody.set("payment_intent_data[metadata][appointment_id]", link.appointment_id);
    stripeBody.set("payment_intent_data[metadata][payment_link_id]", paymentLinkId);
    stripeBody.set("payment_intent_data[metadata][tip_amount]", String(tipAmount));

    const stripeHeaders: Record<string, string> = {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (link.stripe_connected_account_id) {
      stripeHeaders["Stripe-Account"] = link.stripe_connected_account_id;
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: stripeHeaders,
      body: stripeBody,
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      throw new Error(session?.error?.message ?? "Unable to create Stripe session.");
    }

    // Update the payment link record with session info and tip
    await supabaseAdmin
      .from("appointment_payment_links")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        checkout_url: session.url,
        tip_amount: tipAmount,
        status: "pending",
        expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
      })
      .eq("id", paymentLinkId);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create payment session." },
      { status: 500 }
    );
  }
}
