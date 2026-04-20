import Link from "next/link";

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-slate-900">Thank you</h1>
        <p className="mt-3 text-slate-600">
          Your onboarding form has been submitted successfully.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-teal-600 px-5 py-3 font-medium text-white transition hover:bg-teal-700"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}