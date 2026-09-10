import { supabaseAdmin } from "@/lib/supabase-admin";

export type CardBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

/**
 * Resolves a card-on-file link id to the business's branding, for dynamic
 * metadata/OG image generation on /add-card/[id].
 */
export async function getCardBranding(
  cardLinkId: string
): Promise<CardBranding | null> {
  const { data: link } = await supabaseAdmin
    .from("customer_payment_methods")
    .select("business_id")
    .eq("id", cardLinkId)
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
