import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { verifyCronRequest } from "../../../../lib/cron-auth";
import { assignPhoneNumberToCampaign } from "../../../../lib/telnyx";

// Retries 10DLC campaign assignment for any business whose number was
// purchased but never confirmed linked to the campaign. The very first
// attempt happens immediately after purchase (see lib/telnyx.ts), but that
// can legitimately fail if it races ahead of Telnyx finishing provisioning
// the number -- this cron is what turns that one-shot attempt into
// something that actually recovers instead of failing silently forever.
export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("business_sms_setup")
      .select("business_id, phone_number")
      .not("phone_number", "is", null)
      .is("campaign_assigned_at", null);

    if (pendingError) throw new Error(pendingError.message);

    let attempted = 0;
    let succeeded = 0;

    for (const row of pending ?? []) {
      const phoneNumber = String(row.phone_number ?? "").trim();
      const businessId = String(row.business_id ?? "").trim();
      if (!phoneNumber || !businessId) continue;

      attempted++;
      const result = await assignPhoneNumberToCampaign(phoneNumber);

      if (result.ok) {
        succeeded++;
        await supabaseAdmin
          .from("business_sms_setup")
          .update({
            campaign_assigned_at: new Date().toISOString(),
            campaign_assignment_last_error: null,
          })
          .eq("business_id", businessId);
      } else {
        await supabaseAdmin
          .from("business_sms_setup")
          .update({ campaign_assignment_last_error: result.error ?? null })
          .eq("business_id", businessId);
      }
    }

    return NextResponse.json({ ok: true, attempted, succeeded });
  } catch (error) {
    console.error("[telnyx/retry-campaign-assignment] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Retry job failed unexpectedly.",
      },
      { status: 500 }
    );
  }
}
