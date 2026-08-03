import { NextResponse } from "next/server";
import { OfferType } from "@apple/app-store-server-library";
import { describeAppleError, getAppleTransactionInfo, verifyAppleTransaction, planFromProductId } from "../../../../lib/apple-app-store";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendNewAccountNotification } from "../../../../lib/email";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoFromMillis(value?: number | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let businessId: string | null = null;

  try {
    const body = await request.json();

    const transactionId = cleanText(body.transactionId);
    const password = cleanText(body.password);
    const fullName = cleanText(body.fullName);
    const businessName = cleanText(body.businessName);
    const phone = cleanText(body.phone);
    const email = cleanText(body.email).toLowerCase();

    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing Apple transaction id." },
        { status: 400 }
      );
    }

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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // --- Verify the transaction with Apple ---
    const { signedTransactionInfo } =
      await getAppleTransactionInfo(transactionId);

    if (!signedTransactionInfo) {
      return NextResponse.json(
        { error: "Apple did not return transaction details." },
        { status: 400 }
      );
    }

    const transaction = await verifyAppleTransaction(signedTransactionInfo);

    const plan = planFromProductId(transaction.productId);

    if (!plan) {
      return NextResponse.json(
        { error: `Unrecognized product id: ${transaction.productId}` },
        { status: 400 }
      );
    }

    const originalTransactionId = transaction.originalTransactionId;

    if (!originalTransactionId) {
      return NextResponse.json(
        { error: "Apple transaction is missing an original transaction id." },
        { status: 400 }
      );
    }

    // --- Idempotency: already provisioned for this subscription? ---
    const { data: existingBusiness } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("payment_subscription_id", originalTransactionId)
      .maybeSingle();

    if (existingBusiness) {
      return NextResponse.json({
        ok: true,
        email,
        businessId: existingBusiness.id,
      });
    }

    const isTrialing = transaction.offerType === OfferType.INTRODUCTORY_OFFER;
    const purchaseStartsAt =
      toIsoFromMillis(transaction.purchaseDate) ?? new Date().toISOString();
    const periodEndsAt = toIsoFromMillis(transaction.expiresDate);

    // --- Create Supabase user ---
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          business_name: businessName,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message?.toLowerCase().includes("already")
              ? "An account with this email already exists. Please log in instead."
              : authError?.message ?? "Unable to create your account.",
        },
        { status: 400 }
      );
    }

    userId = authData.user.id;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: businessName,
        owner_user_id: userId,
        subscription_status: isTrialing ? "trialing" : "active",
        app_access_status: isTrialing ? "trialing" : "active",
        trial_starts_at: isTrialing ? purchaseStartsAt : null,
        trial_ends_at: isTrialing ? periodEndsAt : null,
        current_period_starts_at: purchaseStartsAt,
        current_period_ends_at: periodEndsAt,
        cancel_at_period_end: false,
        payment_provider: "apple",
        payment_customer_id: originalTransactionId,
        payment_subscription_id: originalTransactionId,
        last_payment_status: isTrialing ? "trialing" : "paid",
        plan,
      })
      .select("id")
      .single();

    if (businessError || !business) {
      throw new Error(businessError?.message ?? "Unable to create business.");
    }

    businessId = business.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          business_id: businessId,
          full_name: fullName,
          role: "admin",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: settingsError } = await supabaseAdmin
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          business_mode: "mobile_grooming",
          business_name: businessName,
          phone: phone || null,
          sms_enabled: false,
          reschedule_sms_enabled: false,
          default_customer_sms_mode: "enabled",
          sms_timezone: "America/Los_Angeles",
          ask_confirmation_day_before: false,
        },
        { onConflict: "business_id" }
      );

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const { error: smsSetupError } = await supabaseAdmin
      .from("business_sms_setup")
      .upsert(
        {
          business_id: businessId,
          status: "needs_info",
        },
        { onConflict: "business_id" }
      );

    if (smsSetupError) {
      throw new Error(smsSetupError.message);
    }

    sendNewAccountNotification({
      email,
      businessName,
      fullName,
      plan,
    }).catch((err) => console.error("[new-account-apple] notification email failed:", err));

    return NextResponse.json({
      ok: true,
      email,
      businessId,
    });
  } catch (error) {
    if (businessId) {
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);
    }

    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }

    return NextResponse.json(
      { error: describeAppleError(error) },
      { status: 400 }
    );
  }
}
