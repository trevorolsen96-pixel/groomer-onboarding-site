import { getPaymentBranding } from "@/lib/pay-branding";
import {
  renderGenericOgImage,
  renderBusinessLogoOgImage,
  fetchImageAsDataUri,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Appointment Payment";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const branding = await getPaymentBranding(id);
    const logoDataUri = branding?.logoUrl
      ? await fetchImageAsDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(
        branding!.businessName,
        logoDataUri,
        "Appointment Payment"
      );
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
