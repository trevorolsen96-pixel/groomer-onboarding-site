import { supabaseAdmin } from "@/lib/supabase-admin";

export type ReportBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

/**
 * Resolves a grooming report card's short id to the business's branding,
 * for dynamic metadata/OG image generation on /report/[shortId].
 */
export async function getReportBranding(
  shortId: string
): Promise<ReportBranding | null> {
  const { data: reportCard } = await supabaseAdmin
    .from("pet_report_cards")
    .select("business_id")
    .eq("short_id", shortId)
    .maybeSingle();

  if (!reportCard?.business_id) return null;

  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("business_id", reportCard.business_id)
    .maybeSingle();

  if (!settings) return null;

  return {
    businessName: settings.business_name ?? null,
    logoUrl: settings.logo_url ?? null,
  };
}
