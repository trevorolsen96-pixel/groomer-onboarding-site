import { supabaseAdmin } from "@/lib/supabase-admin";

export type OnboardingBranding = {
  businessName: string | null;
  logoUrl: string | null;
  isUpdate: boolean;
};

/**
 * Resolves an onboarding token (real token or a groomer's own
 * "preview-<businessId>" token) to the business's branding, for use in
 * dynamic metadata/OG image generation on /onboarding/[token].
 */
export async function getOnboardingBranding(
  token: string
): Promise<OnboardingBranding | null> {
  const cleanToken = token.trim();

  let businessId: string | null = null;
  let isUpdate = false;

  if (cleanToken.startsWith("preview-")) {
    businessId = cleanToken.slice("preview-".length);
  } else {
    const { data: requestRow } = await supabaseAdmin
      .from("onboarding_requests")
      .select("business_id, customer_id")
      .eq("token", cleanToken)
      .single();

    if (!requestRow) return null;
    businessId = requestRow.business_id;
    isUpdate = !!requestRow.customer_id;
  }

  if (!businessId) return null;

  const { data: settingsRow } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("business_id", businessId)
    .single();

  if (!settingsRow) return null;

  return {
    businessName: settingsRow.business_name ?? null,
    logoUrl: settingsRow.logo_url ?? null,
    isUpdate,
  };
}
