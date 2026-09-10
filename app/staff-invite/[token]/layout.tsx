import type { Metadata } from "next";
import { getStaffInviteBranding } from "@/lib/staff-invite-branding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  let branding = null;
  try {
    const { token } = await params;
    branding = await getStaffInviteBranding(token);
  } catch {
    branding = null;
  }

  const title = "Staff Invite";
  const description = branding?.businessName
    ? `You've been invited to join ${branding.businessName} on Wagzly.`
    : "You've been invited to join a business on Wagzly.";

  return {
    title,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function StaffInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
