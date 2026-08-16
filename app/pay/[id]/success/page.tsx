import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Look up review link via payment link → business → business_settings
  let reviewLink: string | null = null;
  let businessName: string | null = null;

  try {
    const { data: link } = await supabaseAdmin
      .from("appointment_payment_links")
      .select("business_id")
      .eq("id", id)
      .maybeSingle();

    if (link?.business_id) {
      const { data: settings } = await supabaseAdmin
        .from("business_settings")
        .select("review_link, business_name")
        .eq("business_id", link.business_id)
        .maybeSingle();

      reviewLink = settings?.review_link ?? null;
      businessName = settings?.business_name ?? null;
    }
  } catch {
    // Fail silently — success page should always show
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
      <div className="w-full max-w-md space-y-5 text-center">

        <div className="soft-card p-8 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-green-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Payment received!</h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Thank you — your payment has been processed successfully.
            Your groomer has been notified.
          </p>

          {reviewLink && (
            <div className="pt-2 border-t border-[var(--divider-soft)]">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Enjoyed your groom{businessName ? ` at ${businessName}` : ""}? Leave a quick review!
              </p>
              <a
                href={reviewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button inline-flex items-center gap-2 justify-center w-full"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                Leave a Review
              </a>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs text-[var(--text-secondary)]">
              Powered by{" "}
              <span className="font-semibold text-[var(--rose-primary)]">Wagzly</span>
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
