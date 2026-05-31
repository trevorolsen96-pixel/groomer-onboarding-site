import { supabaseAdmin } from "./supabase-admin";

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
  const pushUrl = process.env.GOOGLE_PUSH_FUNCTION_URL;
  const pushSecret = process.env.WAGZLY_PUSH_SECRET;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (!pushUrl || !pushSecret || !serviceAccountEmail) return;

  try {
    // Get OIDC token via Vercel
    const { getVercelOidcToken } = await import("@vercel/functions/oidc");
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

    if (!stsResponse.ok) return;
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

    if (!iamResponse.ok) return;
    const iamJson = await iamResponse.json();

    await fetch(pushUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${iamJson.token}`,
        "Content-Type": "application/json",
        "x-wagzly-push-secret": pushSecret,
      },
      body: JSON.stringify({
        businessId,
        title,
        body,
        data: data ?? {},
      }),
    });
  } catch (_) {
    // Push failures are never fatal
  }
}
