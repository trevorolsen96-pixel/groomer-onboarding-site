import { getReportBranding } from "@/lib/report-branding";
import {
  renderGenericOgImage,
  renderBusinessLogoOgImage,
  fetchImageAsDataUri,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Grooming Report";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  try {
    const { shortId } = await params;
    const branding = await getReportBranding(shortId);
    const logoDataUri = branding?.logoUrl
      ? await fetchImageAsDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(branding!.businessName, logoDataUri, "Grooming Report");
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
