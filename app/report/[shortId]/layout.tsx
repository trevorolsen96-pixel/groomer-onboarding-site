import type { Metadata } from "next";
import { getReportBranding } from "@/lib/report-branding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  let branding = null;
  try {
    const { shortId } = await params;
    branding = await getReportBranding(shortId);
  } catch {
    branding = null;
  }

  const title = "Grooming Report";
  const description = branding?.businessName
    ? `${branding.businessName} — see how your pet's grooming went.`
    : "See how your pet's grooming went.";

  return {
    title,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
