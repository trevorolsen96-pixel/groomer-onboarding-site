import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import PayPage from "./PayPage";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: link, error } = await supabaseAdmin
    .from("appointment_payment_links")
    .select("id, business_id, appointment_id, amount, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("payment_link query error:", JSON.stringify(error));
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-red-600">Unable to load payment: {error.message}</p>
      </main>
    );
  }

  if (!link) notFound();

  if (link.status === "paid") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
        <div className="w-full max-w-md soft-card p-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-green-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Already paid</h1>
          <p className="text-sm text-[var(--text-secondary)]">This appointment has already been paid. Thank you!</p>
        </div>
      </main>
    );
  }

  // Load business settings and appointment info
  const [{ data: businessSettings }, { data: appointment }] = await Promise.all([
    supabaseAdmin
      .from("business_settings")
      .select("business_name, logo_url")
      .eq("business_id", link.business_id)
      .maybeSingle(),
    supabaseAdmin
      .from("appointments")
      .select("customer_id, service_type, total_price, discount_percent")
      .eq("id", link.appointment_id)
      .maybeSingle(),
  ]);

  let customerName = "Customer";
  if (appointment?.customer_id) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("name")
      .eq("id", appointment.customer_id)
      .maybeSingle();
    if (customer?.name) customerName = customer.name;
  }

  const businessName = businessSettings?.business_name ?? "Your Groomer";
  const logoUrl = businessSettings?.logo_url ?? null;
  const amountDue = Number(link.amount ?? 0);
  const servicesTotal = Number(appointment?.total_price ?? amountDue);
  const discountPercent = Number(appointment?.discount_percent ?? 0);

  return (
    <PayPage
      paymentLinkId={link.id}
      businessName={businessName}
      logoUrl={logoUrl}
      customerName={customerName}
      amountDue={amountDue}
      servicesTotal={servicesTotal}
      discountPercent={discountPercent}
    />
  );
}
