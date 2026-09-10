import { getCardBranding } from "@/lib/card-branding";
import {
  renderGenericOgImage,
  renderBusinessLogoOgImage,
  fetchImageAsDataUri,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Save a Card";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const branding = await getCardBranding(id);
    const logoDataUri = branding?.logoUrl
      ? await fetchImageAsDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(branding!.businessName, logoDataUri, "Save a Card");
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
