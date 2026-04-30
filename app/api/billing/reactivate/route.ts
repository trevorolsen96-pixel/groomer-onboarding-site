import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

async function getAuthedAdminBusiness(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) throw new Error("Missing auth token.");

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, business_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) throw new Error("Profile not found.");

  if (profile.role !== "admin") {
    throw new Error("Only admins can manage billing.");
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select(
      "id, name, payment_customer_id, payment_subscription_id, subscription_status"
    )
    .eq("id", profile.business_id)
    .maybeSingle();

  if (businessError || !business) throw new Error("Business not found.");

  return {
    user: userData.user,
    profile,
    business,
  };
}

export async function POST(request: Request) {
  try {
    const { user, business } = await getAuthedAdminBusiness(request);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const priceId = process.env.STRIPE_BASIC_PRICE_ID;

    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    if (!priceId) throw new Error("Missing STRIPE_BASIC_PRICE_ID.");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer:
        business.payment_customer_id &&
        typeof business.payment_customer_id === "string"
          ? business.payment_customer_id
          : undefined,
      customer_email: !business.payment_customer_id ? user.email : undefined,
      payment_method_collection: "always",
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          business_id: business.id,
          billing_action: "reactivate",
        },
      },
      metadata: {
        business_id: business.id,
        billing_action: "reactivate",
      },
      success_url: `${siteUrl}/account?tab=billing&billing=reactivated`,
      cancel_url: `${siteUrl}/account?tab=billing&billing=cancelled`,
    });

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
            : "Unable to restart billing.",
      },
      { status: 400 }
    );
  }
}