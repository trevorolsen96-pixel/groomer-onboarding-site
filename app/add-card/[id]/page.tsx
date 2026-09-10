import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { getCardBranding } from "@/lib/card-branding";
import AddCardPage from "./AddCardPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  let branding = null;
  try {
    const { id } = await params;
    branding = await getCardBranding(id);
  } catch {
    branding = null;
  }

  const title = "Save a Card";
  const description = branding?.businessName
    ? `${branding.businessName} — securely save a card on file.`
    : "Securely save a card on file with your groomer.";

  return {
    title,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function CardOnFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: link, error } = await supabaseAdmin
    .from("customer_payment_methods")
    .select("id, business_id, customer_id, status, card_brand, card_last4")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("customer_payment_methods query error:", JSON.stringify(error));
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-red-600">Unable to load request: {error.message}</p>
      </main>
    );
  }

  if (!link) notFound();

  const [{ data: businessSettings }, { data: customer }] = await Promise.all([
    supabaseAdmin
      .from("business_settings")
      .select("business_name, logo_url")
      .eq("business_id", link.business_id)
      .maybeSingle(),
    supabaseAdmin
      .from("customers")
      .select("name")
      .eq("id", link.customer_id)
      .maybeSingle(),
  ]);

  const businessName = businessSettings?.business_name ?? "Your Groomer";
  const logoUrl = businessSettings?.logo_url ?? null;
  const customerName = customer?.name ?? "Customer";

  return (
    <AddCardPage
      cardLinkId={link.id}
      businessName={businessName}
      logoUrl={logoUrl}
      customerName={customerName}
      existingCard={
        link.status === "active" && link.card_brand && link.card_last4
          ? { brand: link.card_brand, last4: link.card_last4 }
          : null
      }
    />
  );
}
