import { getStaffInviteBranding } from "@/lib/staff-invite-branding";
import {
  renderGenericOgImage,
  renderBusinessLogoOgImage,
  fetchImageAsDataUri,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Staff Invite";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { token } = await params;
    const branding = await getStaffInviteBranding(token);
    const logoDataUri = branding?.logoUrl
      ? await fetchImageAsDataUri(branding.logoUrl)
      : null;

    if (logoDataUri) {
      return renderBusinessLogoOgImage(branding!.businessName, logoDataUri, "Staff Invite");
    }
  } catch {
    // Fall through to the generic Wagzly image below.
  }

  return renderGenericOgImage();
}
