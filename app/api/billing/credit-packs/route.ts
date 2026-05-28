import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

async function getAuthenticatedBusiness(request: Request) {
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
  if (profile.role !== "admin") throw new Error("Only admins can manage billing.");

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, plan, payment_subscription_id, sms_credit_packs, app_access_status")
    .eq("id", profile.business_id)
    .maybeSingle();
  if (businessError || !business) throw new Error("Business not found.");

  return business;
}

const BASE_SMS_LIMIT: Record<string, number> = {
  pro: 900,
  basic: 200,
};

async function getUsedCreditsThisPeriod(businessId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("get_sms_credit_summary", {
    p_business_id: businessId,
  });

  if (error) throw new Error("Unable to fetch SMS usage.");

  // RPC returns a single row (or array with one row depending on return type)
  const row = Array.isArray(data) ? data[0] : data;
  return row?.used_credits ?? 0;
}

// POST — add one credit pack
export async function POST(request: Request) {
  try {
    const business = await getAuthenticatedBusiness(request);

    if (business.plan !== "pro") {
      return NextResponse.json(
        { error: "SMS credit packs are only available on Wagzly Pro." },
        { status: 403 }
      );
    }

    if (!business.payment_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 400 }
      );
    }

    const creditPackPriceId = process.env.STRIPE_SMS_CREDIT_PACK_PRICE_ID;
    if (!creditPackPriceId) throw new Error("Missing STRIPE_SMS_CREDIT_PACK_PRICE_ID.");

    const subscription = await stripe.subscriptions.retrieve(
      business.payment_subscription_id,
      { expand: ["items"] }
    );

    const existingItem = subscription.items.data.find(
      (item) => item.price.id === creditPackPriceId
    );

    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: (existingItem.quantity ?? 0) + 1,
        proration_behavior: "none",
      });
    } else {
      await stripe.subscriptions.update(business.payment_subscription_id, {
        items: [{ price: creditPackPriceId, quantity: 1 }],
        proration_behavior: "none",
      });
    }

    const newCount = (business.sms_credit_packs ?? 0) + 1;

    await supabaseAdmin
      .from("businesses")
      .update({ sms_credit_packs: newCount })
      .eq("id", business.id);

    return NextResponse.json({ ok: true, sms_credit_packs: newCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to add credit pack.",
      },
      { status: 400 }
    );
  }
}

// DELETE — remove one credit pack
export async function DELETE(request: Request) {
  try {
    const business = await getAuthenticatedBusiness(request);

    if (!business.payment_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 400 }
      );
    }

    const creditPackPriceId = process.env.STRIPE_SMS_CREDIT_PACK_PRICE_ID;
    if (!creditPackPriceId) throw new Error("Missing STRIPE_SMS_CREDIT_PACK_PRICE_ID.");

    const currentPacks = business.sms_credit_packs ?? 0;

    if (currentPacks === 0) {
      return NextResponse.json(
        { error: "No credit packs to remove." },
        { status: 400 }
      );
    }

    // Check whether current usage would exceed the limit after removing one pack.
    // Limit after removal = base plan limit + (currentPacks - 1) × 200
    const baseLimit = BASE_SMS_LIMIT[business.plan ?? ""] ?? 0;
    const limitAfterRemoval = baseLimit + (currentPacks - 1) * 200;
    const usedCredits = await getUsedCreditsThisPeriod(business.id);

    if (usedCredits > limitAfterRemoval) {
      return NextResponse.json(
        {
          error: `You've used ${usedCredits} SMS this period. Removing a pack would lower your limit to ${limitAfterRemoval}, which is below your current usage. The pack will be removed automatically at the end of your billing cycle.`,
        },
        { status: 403 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      business.payment_subscription_id,
      { expand: ["items"] }
    );

    const existingItem = subscription.items.data.find(
      (item) => item.price.id === creditPackPriceId
    );

    if (!existingItem || (existingItem.quantity ?? 0) === 0) {
      return NextResponse.json(
        { error: "No credit packs to remove." },
        { status: 400 }
      );
    }

    if ((existingItem.quantity ?? 0) <= 1) {
      await stripe.subscriptionItems.del(existingItem.id, {
        proration_behavior: "none",
      });
    } else {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: (existingItem.quantity ?? 1) - 1,
        proration_behavior: "none",
      });
    }

    const newCount = Math.max(0, currentPacks - 1);

    await supabaseAdmin
      .from("businesses")
      .update({ sms_credit_packs: newCount })
      .eq("id", business.id);

    return NextResponse.json({ ok: true, sms_credit_packs: newCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove credit pack.",
      },
      { status: 400 }
    );
  }
}
