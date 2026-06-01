import Image from "next/image";
import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
      <div className="w-full max-w-md space-y-5 text-center">

        <Image src="/images/logo/WagzlyHLarge.png" alt="Wagzly" width={160} height={44} className="mx-auto" />

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

          <div className="pt-2">
            <p className="text-xs text-[var(--text-secondary)]">
              Powered by{" "}
              <Link href="/" className="font-semibold text-[var(--rose-primary)] hover:underline">
                Wagzly
              </Link>
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
