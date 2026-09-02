import { NextRequest, NextResponse } from "next/server";
import { callRefreshBadges } from "@/lib/push-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called directly by a Postgres trigger (via pg_net -- see
// supabase/migrations/*_badge_refresh_triggers.sql) the moment something
// that affects a badge count changes: a message gets marked read, a
// booking request or onboarding submission gets resolved. This exists as
// a public Next.js route, rather than Postgres calling the refreshBadges
// Cloud Function directly, because Postgres has no way to generate the
// Google-signed identity token that function's IAM policy requires --
// this route re-authenticates on the database's behalf using the same
// Vercel OIDC flow every other push call already uses, gated by the same
// shared secret every other webhook route in this app checks.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wagzly-push-secret");
  if (secret !== process.env.WAGZLY_PUSH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await req.json();
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  await callRefreshBadges(businessId);

  return NextResponse.json({ ok: true });
}
