import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { sendPushToBusinessAsync } from "../../../../lib/push-notification";
import { verifyCronRequest } from "../../../../lib/cron-auth";

// One-off/occasional admin broadcast tool -- sends a push notification to
// every business with active SMS setup. Reuses the same CRON_SECRET auth
// as the scheduled routes (see lib/cron-auth.ts) since this is meant to be
// triggered manually by us, not exposed publicly. Title/body are query
// params rather than hardcoded so this is reusable for the next announcement
// without a code change.
export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const title = url.searchParams.get("title")?.trim();
  const body = url.searchParams.get("body")?.trim();

  if (!title || !body) {
    return NextResponse.json(
      { error: "Missing required 'title' and 'body' query params." },
      { status: 400 }
    );
  }

  const { data: setups, error } = await supabaseAdmin
    .from("business_sms_setup")
    .select("business_id")
    .in("status", ["active", "approved"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessIds = (setups ?? []).map((row) => row.business_id as string);

  for (const businessId of businessIds) {
    await sendPushToBusinessAsync({
      businessId,
      title,
      body,
      data: { type: "announcement" },
    });
  }

  return NextResponse.json({ ok: true, sentCount: businessIds.length });
}
