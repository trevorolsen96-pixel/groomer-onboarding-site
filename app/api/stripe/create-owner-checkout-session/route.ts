import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

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

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "You must accept the Terms and Privacy Policy." },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const priceId = process.env.STRIPE_BASIC_PRICE_ID;

    if (!siteUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL." },
        { status: 500 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_BASIC_PRICE_ID." },
        { status: 500 }
      );
    }

    const { data: pendingSignup, error: pendingError } = await supabaseAdmin
      .from("pending_business_signups")
      .insert({
        full_name: fullName,
        business_name: businessName,
        phone: phone || null,
        email,
        status: "pending",
      })
      .select("id")
      .single();

    if (pendingError || !pendingSignup) {
      return NextResponse.json(
        { error: pendingError?.message ?? "Unable to start signup." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      payment_method_collection: "always",
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          pending_signup_id: pendingSignup.id,
          business_name: businessName,
        },
      },
      metadata: {
        pending_signup_id: pendingSignup.id,
        full_name: fullName,
        business_name: businessName,
        email,
      },
      success_url: `${siteUrl}/create-account/finish?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/create-account?checkout=cancelled`,
    });

    const { error: updateError } = await supabaseAdmin
      .from("pending_business_signups")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
      })
      .eq("id", pendingSignup.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong starting checkout.",
      },
      { status: 500 }
    );
  }
}