import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
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
      .select("id, payment_customer_id")
      .eq("id", profile.business_id)
      .maybeSingle();

    if (businessError || !business) throw new Error("Business not found.");

    if (!business.payment_customer_id) {
      throw new Error("No Stripe customer is connected to this account yet.");
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");

    const session = await stripe.billingPortal.sessions.create({
      customer: business.payment_customer_id,
      return_url: `${siteUrl}/account?tab=billing`,
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
            : "Unable to open billing portal.",
      },
      { status: 400 }
    );
  }
}