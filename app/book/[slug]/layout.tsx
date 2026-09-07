import type { Metadata } from "next";
import { getBookingBranding } from "@/lib/book-branding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  let branding = null;
  try {
    const { slug } = await params;
    branding = await getBookingBranding(slug);
  } catch {
    branding = null;
  }

  const title = "Online Booking";
  const description = branding?.businessName
    ? `${branding.businessName} — book your next appointment online.`
    : "Book your next appointment online.";

  return {
    title,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
