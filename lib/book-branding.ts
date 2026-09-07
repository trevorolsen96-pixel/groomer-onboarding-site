import { supabaseAdmin } from "@/lib/supabase-admin";

export type BookBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

/**
 * Resolves a groomer's public booking slug to their branding, for dynamic
 * metadata/OG image generation on /book/[slug].
 */
export async function getBookingBranding(
  slug: string
): Promise<BookBranding | null> {
  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (!settings) return null;

  return {
    businessName: settings.business_name ?? null,
    logoUrl: settings.logo_url ?? null,
  };
}
