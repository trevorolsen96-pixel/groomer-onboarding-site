import { getOnboardingBranding } from "@/lib/onboarding-branding";
import { renderGenericOgImage, renderBusinessLogoOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Client Onboarding Form";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

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
    const branding = await getOnboardingBranding(token);
    const logoDataUri = branding?.logoUrl
      ? await fetchLogoDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(branding!.businessName, logoDataUri);
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
