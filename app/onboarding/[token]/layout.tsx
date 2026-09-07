import type { Metadata } from "next";
import { getOnboardingBranding } from "@/lib/onboarding-branding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  let branding = null;
  try {
    const { token } = await params;
    branding = await getOnboardingBranding(token);
  } catch {
    branding = null;
  }

  const title = branding?.isUpdate
    ? "Update Your Information"
    : "Client Onboarding Form";
  const description = branding?.businessName
    ? `${branding.businessName} — please fill out this quick client form.`
    : "Please fill out this quick client form.";

  return {
    title,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
