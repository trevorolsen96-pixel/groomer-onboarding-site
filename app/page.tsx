import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
        <div className="w-full">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-[var(--divider-soft)] bg-[var(--warm-surface)] p-8 shadow-sm sm:p-12">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rose-primary)]">
              Mobile Grooming
            </p>

            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
              Simple client onboarding for your grooming business
            </h1>

            <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
              This site is used for secure customer onboarding links. Clients can
              fill out their contact information, pet details, SMS consent, and
              required agreements before their appointment.
            </p>

            <div className="mt-8 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-5">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Customer links look like this:
              </p>
              <code className="mt-3 inline-block rounded-xl bg-white px-4 py-3 text-sm text-[var(--text-secondary)] ring-1 ring-[var(--divider-soft)]">
                /onboarding/your-unique-token
              </code>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/thank-you" className="primary-button">
                View thank-you page
              </Link>
            </div>

            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              Clients should only use the personal onboarding link sent to them
              by their groomer.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}