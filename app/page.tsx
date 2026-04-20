import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Mobile Grooming
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Branded customer onboarding for your grooming business
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Each customer gets a unique onboarding link with your business name,
            logo, and a form for owner details, SMS opt-in, and multiple pets.
          </p>

          <div className="mt-8">
            <p className="text-sm text-slate-500">
              This page is just a placeholder home page. Your real customer links
              will look like:
            </p>
            <code className="mt-3 inline-block rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">
              /onboarding/your-unique-token
            </code>
          </div>

          <div className="mt-8">
            <Link
              href="/thank-you"
              className="rounded-xl bg-teal-600 px-5 py-3 font-medium text-white transition hover:bg-teal-700"
            >
              View thank-you page
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}