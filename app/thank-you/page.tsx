export default function ThankYouPage() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-[28px] border border-[var(--divider-soft)] bg-[var(--warm-surface)] p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--rose-soft)] text-3xl">
            ✓
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rose-primary)]">
            Submission complete
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            Thank you
          </h1>

          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Your information has been submitted successfully. Your groomer will
            review your details and follow up if anything else is needed.
          </p>

          <div className="mt-8 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-5 text-sm text-[var(--text-secondary)]">
            You can now close this page.
          </div>
        </div>
      </section>
    </main>
  );
}