import { getVercelOidcToken } from "@vercel/oidc";
import { supabaseAdmin } from "./supabase-admin";

// Shared by every notification type that should only ever reach the
// business's admins/owners -- booking requests and onboarding submissions
// aren't assigned to any specific staff member, so unlike messages or
// appointments there's no per-worker scoping to compute; admin-only is the
// correct default rather than a fallback.
export async function resolveAdminProfileIds(businessId: string): Promise<string[]> {
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("business_id", businessId)
    .eq("role", "admin");

  return (admins ?? []).map((row) => row.id as string);
}

// Exchanges Vercel's OIDC token for a GCP identity token authorized to call
// a specific Cloud Function -- `pushUrl` doubles as both the fetch target
// and the token's required audience, so this works for any Cloud Function
// that trusts the same two invoker identities (see
// `gcloud run services get-iam-policy`), not just sendMessagePush. Shared
// by every push-sending helper below -- returns null (rather than
// throwing) if any step fails or the required env vars aren't set, so
// callers can just no-op.
async function getAuthorizedPushHeaders(pushUrl: string | undefined): Promise<{
  pushUrl: string;
  headers: Record<string, string>;
} | null> {
  const pushSecret = process.env.WAGZLY_PUSH_SECRET;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (!pushUrl || !pushSecret || !serviceAccountEmail) {
    console.log("[push] Skipped — target URL, WAGZLY_PUSH_SECRET, or GCP_SERVICE_ACCOUNT_EMAIL not set");
    return null;
  }

  try {
    const vercelToken = await getVercelOidcToken();

    const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        audience:
          "//iam.googleapis.com/projects/443606887092/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider",
        scope: "https://www.googleapis.com/auth/cloud-platform",
        requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        subject_token: vercelToken,
      }),
    });

    if (!stsResponse.ok) return null;
    const stsJson = await stsResponse.json();

    const iamResponse = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateIdToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stsJson.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audience: pushUrl, includeEmail: true }),
      }
    );

    if (!iamResponse.ok) return null;
    const iamJson = await iamResponse.json();

    return {
      pushUrl,
      headers: {
        Authorization: `Bearer ${iamJson.token}`,
        "Content-Type": "application/json",
        "x-wagzly-push-secret": pushSecret,
      },
    };
  } catch (err) {
    console.error("[push] Auth failed:", err);
    return null;
  }
}

// Reuses the same OIDC + GCP Cloud Function approach as the messages route
export async function sendPushToBusinessAsync({
  businessId,
  title,
  body,
  data,
}: {
  businessId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const authorized = await getAuthorizedPushHeaders(process.env.GOOGLE_PUSH_FUNCTION_URL);
  if (!authorized) return;

  try {
    await fetch(authorized.pushUrl, {
      method: "POST",
      headers: authorized.headers,
      body: JSON.stringify({
        businessId,
        title,
        body,
        // Everything the app needs to deep-link to the right screen --
        // the Cloud Function passes this through to FCM's data payload
        // as-is (see cloud-functions/sendmessagepush/index.js), so any
        // field added here (appointmentId, customerId, requestId, etc)
        // reaches the app with no Cloud Function changes needed.
        data: data ?? {},
      }),
    });
    console.log("[push] Sent successfully to business:", businessId);
  } catch (err) {
    console.error("[push] Failed:", err);
  }
}

// Same as sendPushToBusinessAsync, but scoped to a specific set of
// profiles within the business rather than every device on the account --
// e.g. notifying the one staff member a client is assigned to, in addition
// to the business's admins, without waking up every other groomer's phone.
// [profileIds] must be non-empty; the Cloud Function still requires
// businessId (used for the fallback/legacy shape and logging), it just
// additionally filters push tokens down to these specific profiles.
export async function sendPushToProfilesAsync({
  businessId,
  profileIds,
  title,
  body,
  data,
}: {
  businessId: string;
  profileIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(Boolean)));
  if (!uniqueProfileIds.length) return;

  const authorized = await getAuthorizedPushHeaders(process.env.GOOGLE_PUSH_FUNCTION_URL);
  if (!authorized) return;

  try {
    await fetch(authorized.pushUrl, {
      method: "POST",
      headers: authorized.headers,
      body: JSON.stringify({
        businessId,
        profileIds: uniqueProfileIds,
        title,
        body,
        data: data ?? {},
      }),
    });
    console.log(
      "[push] Sent successfully to profiles:",
      uniqueProfileIds.length,
      "in business:",
      businessId
    );
  } catch (err) {
    console.error("[push] Failed:", err);
  }
}

// Called by the /api/badges/refresh route, which in turn is called
// directly by a Postgres trigger (see
// supabase/migrations/*_badge_refresh_triggers.sql) whenever something
// that affects a badge count changes. Reuses the same OIDC-authenticated
// calling pattern as the two functions above, just against the
// refreshBadges Cloud Function instead of sendMessagePush -- Postgres
// itself has no way to generate the Google-signed token that function's
// IAM policy requires, which is why this hop through Vercel exists at all.
export async function callRefreshBadges(businessId: string): Promise<void> {
  const authorized = await getAuthorizedPushHeaders(process.env.GOOGLE_REFRESH_BADGES_FUNCTION_URL);
  if (!authorized) return;

  try {
    await fetch(authorized.pushUrl, {
      method: "POST",
      headers: authorized.headers,
      body: JSON.stringify({ businessId }),
    });
    console.log("[push] Badge refresh sent for business:", businessId);
  } catch (err) {
    console.error("[push] Badge refresh failed:", err);
  }
}
