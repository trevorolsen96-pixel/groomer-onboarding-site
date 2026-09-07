import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderGenericOgImage, renderBusinessLogoOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Client Onboarding Form";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

async function getBusinessBranding(token: string) {
  const cleanToken = token.trim();

  let businessId: string | null = null;
  if (cleanToken.startsWith("preview-")) {
    businessId = cleanToken.slice("preview-".length);
  } else {
    const { data: requestRow } = await supabaseAdmin
      .from("onboarding_requests")
      .select("business_id")
      .eq("token", cleanToken)
      .single();
    businessId = requestRow?.business_id ?? null;
  }

  if (!businessId) return null;

  const { data: settingsRow } = await supabaseAdmin
    .from("business_settings")
    .select("business_name, logo_url")
    .eq("business_id", businessId)
    .single();

  if (!settingsRow?.logo_url) return null;

  return {
    businessName: settingsRow.business_name ?? null,
    logoUrl: settingsRow.logo_url as string,
  };
}

async function fetchLogoDataUri(logoUrl: string) {
  const res = await fetch(logoUrl);
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { token } = await params;
    const branding = await getBusinessBranding(token);
    const logoDataUri = branding ? await fetchLogoDataUri(branding.logoUrl) : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(branding!.businessName, logoDataUri);
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
