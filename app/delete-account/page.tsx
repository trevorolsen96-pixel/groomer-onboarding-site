import Link from "next/link";

export default function DeleteAccountPage() {
  return (
    <main className="site-shell">
      <section className="mx-auto min-h-screen max-w-3xl px-6 py-14">
        <div className="soft-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Wagzly Account Deletion
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">
            Delete your Wagzly account
          </h1>

          <p className="mt-5 leading-7 text-[var(--text-secondary)]">
            You can request deletion of your Wagzly account and associated data
            at any time by emailing Wagzly support.
          </p>

          <div className="mt-8 rounded-2xl bg-[var(--soft-surface)] p-5">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              How to request deletion
            </h2>

            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              Email us from the email address associated with your Wagzly
              account and include the subject line:
            </p>

            <p className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-[var(--text-primary)]">
              Delete my Wagzly account
            </p>

            <a
              href="mailto:support@wagzly.com?subject=Delete%20my%20Wagzly%20account"
              className="primary-button mt-5 inline-flex"
            >
              Email support@wagzly.com
            </a>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Data deleted
            </h2>

            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              When your request is processed, Wagzly will delete or anonymize
              account data associated with your business, including profile
              information, business settings, customer records, pet records,
              appointments, messages, staff records, and related app data.
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Data we may retain
            </h2>

            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              Some records may be retained for a limited time where required for
              legal, tax, billing, fraud prevention, security, or compliance
              purposes. Retained records are limited to what is necessary and
              are deleted when no longer required.
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Processing time
            </h2>

            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              Account deletion requests are typically processed within 30 days
              after we verify the request.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/" className="secondary-button">
              Back to home
            </Link>

            <a
              href="mailto:support@wagzly.com?subject=Delete%20my%20Wagzly%20account"
              className="primary-button"
            >
              Request deletion
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}