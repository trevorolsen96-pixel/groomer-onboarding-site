import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const selectedPlan =
      cleanText(body.plan).toLowerCase() === "pro"
        ? "pro"
        : "basic";

    const fullName = cleanText(body.fullName);
    const businessName = cleanText(body.businessName);
    const phone = cleanText(body.phone);
    const email = cleanText(body.email).toLowerCase();
    const acceptedTerms = body.acceptedTerms === true;

    if (!fullName) {
      return NextResponse.json(
        { error: "Enter your full name." },
        { status: 400 }
      );
    }

    if (!businessName) {
      return NextResponse.json(
        { error: "Enter your business name." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email." },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        {
          error: "You must accept the Terms and Privacy Policy.",
        },
        { status: 400 }
      );
    }

    const { data: existingUsers, error: existingUserError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (existingUserError) {
      return NextResponse.json(
        {
          error: "Unable to verify this email. Please try again.",
        },
        { status: 400 }
      );
    }

    const emailAlreadyExists = existingUsers.users.some(
      (user) => user.email?.toLowerCase() === email
    );

    if (emailAlreadyExists) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        { status: 400 }
      );
    }

    // Ordered + limited rather than maybeSingle() -- defensive against any
    // pre-existing duplicate rows for the same email from before this
    // reuse logic existed, which would otherwise throw here.
    const { data: existingSignups, error: existingPendingError } =
      await supabaseAdmin
        .from("pending_business_signups")
        .select("id, status")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1);

    if (existingPendingError) {
      return NextResponse.json(
        {
          error: "Unable to verify this signup. Please try again.",
        },
        { status: 400 }
      );
    }

    const existingPendingSignup = existingSignups?.[0] ?? null;

    // A "completed" row means a business was already created for this
    // email -- the earlier auth.admin.listUsers() check should already
    // catch that via the real account, but this is a defensive backstop
    // in case that user/account creation step ever fails partway through.
    if (existingPendingSignup?.status === "completed") {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    const priceId =
      selectedPlan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_BASIC_PRICE_ID;

    if (!siteUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL." },
        { status: 500 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Missing ${
            selectedPlan === "pro"
              ? "STRIPE_PRO_PRICE_ID"
              : "STRIPE_BASIC_PRICE_ID"
          }.`,
        },
        { status: 500 }
      );
    }

    // Reuse an existing (non-completed) pending row for this email instead
    // of blocking -- picks up an abandoned signup where they left off
    // (with whatever they just re-entered) rather than permanently
    // stranding that email if they never finished checkout the first time.
    let pendingSignupId: string;

    if (existingPendingSignup) {
      const { error: reuseError } = await supabaseAdmin
        .from("pending_business_signups")
        .update({
          full_name: fullName,
          business_name: businessName,
          phone: phone || null,
          status: "pending",
          selected_plan: selectedPlan,
        })
        .eq("id", existingPendingSignup.id);

      if (reuseError) {
        return NextResponse.json(
          { error: reuseError.message },
          { status: 400 }
        );
      }

      pendingSignupId = existingPendingSignup.id;
    } else {
      const { data: pendingSignup, error: pendingError } =
        await supabaseAdmin
          .from("pending_business_signups")
          .insert({
            full_name: fullName,
            business_name: businessName,
            phone: phone || null,
            email,
            status: "pending",
            selected_plan: selectedPlan,
          })
          .select("id")
          .single();

      if (pendingError || !pendingSignup) {
        return NextResponse.json(
          {
            error:
              pendingError?.message ??
              "Unable to start signup.",
          },
          { status: 400 }
        );
      }

      pendingSignupId = pendingSignup.id;
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
          pending_signup_id: pendingSignupId,
          business_name: businessName,
          selected_plan: selectedPlan,
        },
      },

      metadata: {
        pending_signup_id: pendingSignupId,
        full_name: fullName,
        business_name: businessName,
        email,
        selected_plan: selectedPlan,
      },

      success_url:
        `${siteUrl}/create-account/finish?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${siteUrl}/create-account?checkout=cancelled`,
    });

    const { error: updateError } =
      await supabaseAdmin
        .from("pending_business_signups")
        .update({
          stripe_checkout_session_id: session.id,
          stripe_customer_id:
            typeof session.customer === "string"
              ? session.customer
              : null,
        })
        .eq("id", pendingSignupId);

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