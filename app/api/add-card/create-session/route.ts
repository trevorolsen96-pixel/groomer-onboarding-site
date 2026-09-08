import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const BASE_URL = "https://www.wagzly.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cardLinkId = String(body.card_link_id ?? "").trim();

    if (!cardLinkId) {
      return NextResponse.json({ error: "Missing card_link_id." }, { status: 400 });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from("customer_payment_methods")
      .select("*")
      .eq("id", cardLinkId)
      .maybeSingle();

    if (linkError) throw new Error(linkError.message);
    if (!link) return NextResponse.json({ error: "Card request not found." }, { status: 404 });

    const successUrl = `${BASE_URL}/add-card/${cardLinkId}/success`;
    const cancelUrl = `${BASE_URL}/add-card/${cardLinkId}`;

    const stripeBody = new URLSearchParams();
    stripeBody.set("mode", "setup");
    stripeBody.set("currency", "usd");
    stripeBody.set("customer", link.stripe_customer_id);
    stripeBody.set("success_url", successUrl);
    stripeBody.set("cancel_url", cancelUrl);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Stripe-Account": link.stripe_connected_account_id,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeBody,
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      throw new Error(session?.error?.message ?? "Unable to create Stripe session.");
    }

    await supabaseAdmin
      .from("customer_payment_methods")
      .update({
        stripe_checkout_session_id: session.id,
        status: "pending",
      })
      .eq("id", cardLinkId);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start card setup." },
      { status: 500 }
    );
  }
}
