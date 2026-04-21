import Link from "next/link";

export default function ThankYouPage() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl items-center justify-center px-6 py-16">
        <div className="soft-card w-full p-8 text-center sm:p-12">
          <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-[var(--rose-soft)] text-4xl">
            ✓
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rose-primary)]">
            Submission complete
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            Thank you
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Your onboarding information has been submitted successfully. Your
            groomer will review your details and follow up if anything else is
            needed before your appointment.
          </p>

          <div className="mt-8 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-5 text-sm leading-6 text-[var(--text-secondary)]">
            You can safely close this page now.
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/" className="secondary-button">
              Back to Wagzly
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}