import { supabaseAdmin } from "@/lib/supabase-admin";

export type PayBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

/**
 * Resolves an appointment payment link id to the business's branding, for
 * dynamic metadata/OG image generation on /pay/[id].
 */
export async function getPaymentBranding(
  paymentLinkId: string
): Promise<PayBranding | null> {
  const { data: link } = await supabaseAdmin
    .from("appointment_payment_links")
    .select("business_id")
    .eq("id", paymentLinkId)
    .maybeSingle();

  if (!link?.business_id) return null;

  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("business_id", link.business_id)
    .maybeSingle();

  if (!settings) return null;

  return {
    businessName: settings.business_name ?? null,
    logoUrl: settings.logo_url ?? null,
  };
}
