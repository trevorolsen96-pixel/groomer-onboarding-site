export const dynamic = "force-dynamic";

export default function AddCardSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
      <div className="w-full max-w-md space-y-5 text-center">

        <div className="soft-card p-8 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-green-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Card saved!</h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Your card has been saved on file. You can close this page.
          </p>

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
