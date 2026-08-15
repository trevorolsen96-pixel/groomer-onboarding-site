import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const BUCKET = "report-card-photos";
// Short-lived on purpose -- this is only for viewing an in-progress report
// card inside the app itself. The client-facing link has its own separate
// 3-day expiry set at send time in /api/reports/send.
const VIEW_LINK_TTL_SECONDS = 60 * 60; // 1 hour

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = cleanText(searchParams.get("businessId"));
    const path = cleanText(searchParams.get("path"));

    if (!businessId || !path) {
      return NextResponse.json(
        { error: "Missing businessId or path." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.business_id !== businessId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    // Every report photo path is namespaced as `{businessId}/...` at
    // upload time -- stops one business requesting a signed link for
    // another business's photo just by guessing/passing a different path.
    if (!path.startsWith(`${businessId}/`)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, VIEW_LINK_TTL_SECONDS);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: signError?.message ?? "Unable to load photo." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, url: signedData.signedUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load photo.",
      },
      { status: 400 }
    );
  }
}
