export default function StaffInviteThankYouPage() {
  return (
    <main className="site-shell flex min-h-screen items-center justify-center px-4 py-10 text-[var(--text-primary)]">
      <div className="soft-card w-full max-w-2xl p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--soft-surface)] text-4xl">
          ✓
        </div>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
          Account created
        </p>

        <h1 className="mt-3 text-4xl font-bold">Welcome to Wagzly</h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
          Your staff account has been created successfully. You can now open the
          Wagzly app and log in with your email and password.
        </p>

        <div className="mt-8 rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] px-5 py-4 text-sm text-[var(--text-secondary)]">
          You can safely close this page.
        </div>

        <a href="/" className="secondary-button mt-8 inline-block px-5 py-3">
          Back to Wagzly
        </a>
      </div>
    </main>
  );
}