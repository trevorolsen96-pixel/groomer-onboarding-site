"use client";

import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-14">
        <div className="soft-card w-full p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Wagzly Account
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">
            Account
          </h1>

          <p className="mt-4 text-[var(--text-secondary)]">
            Your account page is being set up. Soon this will show your trial,
            billing, business profile, and subscription status.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="secondary-button">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}