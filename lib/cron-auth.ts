import { NextResponse } from "next/server";

/**
 * Verifies a cron-only route was actually triggered by Vercel's Cron Jobs
 * system rather than an arbitrary public request. Vercel automatically
 * sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations once
 * CRON_SECRET is set as a project environment variable -- without this
 * check, anyone who finds the route's URL can hit it directly to force
 * premature SMS/reminder sends at the business's expense.
 *
 * Fails OPEN (returns null, i.e. "allowed") if CRON_SECRET isn't
 * configured yet, so shipping this check doesn't silently stop the queue/
 * reminders from running. Set CRON_SECRET in Vercel (Project Settings ->
 * Environment Variables) to actually start enforcing it -- Vercel sends
 * the matching header automatically once that variable exists, no other
 * config needed.
 */
export function verifyCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.warn(
      "[cron-auth] CRON_SECRET is not set -- this cron-only route currently " +
        "accepts any request with no verification. Set CRON_SECRET in Vercel " +
        "to close this."
    );
    return null;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
