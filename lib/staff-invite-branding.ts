import { supabaseAdmin } from "@/lib/supabase-admin";

export type StaffInviteBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

/**
 * Resolves a staff invite token to the business's branding, for dynamic
 * metadata/OG image generation on /staff-invite/[token].
 */
export async function getStaffInviteBranding(
  token: string
): Promise<StaffInviteBranding | null> {
  const { data: invite } = await supabaseAdmin
    .from("staff_invites")
    .select("business_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite?.business_id) return null;

  const { data: settings } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("business_id", invite.business_id)
    .maybeSingle();

  if (!settings) return null;

  return {
    businessName: settings.business_name ?? null,
    logoUrl: settings.logo_url ?? null,
  };
}
