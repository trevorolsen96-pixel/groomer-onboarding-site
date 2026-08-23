import { getVercelOidcToken } from "@vercel/oidc";

// Exchanges Vercel's OIDC token for a GCP identity token authorized to call
// the sendMessagePush Cloud Function. Shared by every push-sending helper
// below -- returns null (rather than throwing) if any step fails or the
// required env vars aren't set, so callers can just no-op.
async function getAuthorizedPushHeaders(): Promise<{
  pushUrl: string;
  headers: Record<string, string>;
} | null> {
  const pushUrl = process.env.GOOGLE_PUSH_FUNCTION_URL;
  const pushSecret = process.env.WAGZLY_PUSH_SECRET;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (!pushUrl || !pushSecret || !serviceAccountEmail) {
    console.log("[push] Skipped — GOOGLE_PUSH_FUNCTION_URL, WAGZLY_PUSH_SECRET, or GCP_SERVICE_ACCOUNT_EMAIL not set");
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
  const authorized = await getAuthorizedPushHeaders();
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

  const authorized = await getAuthorizedPushHeaders();
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
