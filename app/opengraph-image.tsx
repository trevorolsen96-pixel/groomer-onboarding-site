import { renderGenericOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Wagzly | Mobile Grooming Software";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderGenericOgImage();
}
