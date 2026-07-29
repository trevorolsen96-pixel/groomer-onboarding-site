import { NextResponse } from "next/server";
import { NotificationTypeV2, Subtype } from "@apple/app-store-server-library";
import { describeAppleError, getAppleSignedDataVerifier, planFromProductId } from "../../../../lib/apple-app-store";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function toIsoFromMillis(value?: number | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signedPayload = body.signedPayload as string | undefined;

    if (!signedPayload) {
      return NextResponse.json({ error: "Missing signedPayload." }, { status: 400 });
    }

    const notification = await getAppleSignedDataVerifier().verifyAndDecodeNotification(
      signedPayload
    );

    const signedTransactionInfo = notification.data?.signedTransactionInfo;

    if (!signedTransactionInfo) {
      // Notifications like TEST or SUMMARY carry no transaction — nothing to sync.
      return NextResponse.json({ received: true });
    }

    const transaction = await getAppleSignedDataVerifier().verifyAndDecodeTransaction(
      signedTransactionInfo
    );

    const originalTransactionId = transaction.originalTransactionId;

    if (!originalTransactionId) {
      return NextResponse.json({ received: true });
    }

    const plan = planFromProductId(transaction.productId);
    const periodEndsAt = toIsoFromMillis(transaction.expiresDate);

    const baseUpdate = {
      current_period_ends_at: periodEndsAt,
      ...(plan ? { plan } : {}),
    };

    switch (notification.notificationType) {
      case NotificationTypeV2.SUBSCRIBED:
      case NotificationTypeV2.DID_RENEW: {
        await supabaseAdmin
          .from("businesses")
          .update({
            ...baseUpdate,
            subscription_status: "active",
            app_access_status: "active",
            last_payment_status: "paid",
            app_access_grace_until: null,
          })
          .eq("payment_subscription_id", originalTransactionId);
        break;
      }

      case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: {
        await supabaseAdmin
          .from("businesses")
          .update({
            cancel_at_period_end: notification.subtype === Subtype.AUTO_RENEW_DISABLED,
          })
          .eq("payment_subscription_id", originalTransactionId);
        break;
      }

      case NotificationTypeV2.DID_FAIL_TO_RENEW: {
        const inGracePeriod = notification.subtype === Subtype.GRACE_PERIOD;

        await supabaseAdmin
          .from("businesses")
          .update({
            ...baseUpdate,
            subscription_status: "past_due",
            app_access_status: "past_due",
            last_payment_status: "failed",
            app_access_grace_until: inGracePeriod ? periodEndsAt : null,
          })
          .eq("payment_subscription_id", originalTransactionId);
        break;
      }

      case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
      case NotificationTypeV2.EXPIRED: {
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
          .eq("payment_subscription_id", originalTransactionId);
        break;
      }

      case NotificationTypeV2.REFUND:
      case NotificationTypeV2.REVOKE: {
        await supabaseAdmin
          .from("businesses")
          .update({
            subscription_status: "canceled",
            app_access_status: "blocked",
            cancel_at_period_end: false,
            canceled_at: new Date().toISOString(),
            app_access_grace_until: null,
            last_payment_status: "refunded",
          })
          .eq("payment_subscription_id", originalTransactionId);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = describeAppleError(error);
    console.error("[apple-webhook]", message, error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
