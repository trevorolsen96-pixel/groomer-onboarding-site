import { getBookingBranding } from "@/lib/book-branding";
import {
  renderGenericOgImage,
  renderBusinessLogoOgImage,
  fetchImageAsDataUri,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Online Booking";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const branding = await getBookingBranding(slug);
    const logoDataUri = branding?.logoUrl
      ? await fetchImageAsDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(
        branding!.businessName,
        logoDataUri,
        "Online Booking"
      );
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
