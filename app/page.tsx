import Image from "next/image";
import Link from "next/link";
import AccountMenu from "../components/AccountMenu";

const demoBookingUrl = "https://wagzly.zohobookings.com/#/4937476000000034049";

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo/WagzlyApp.png"
            alt="Wagzly"
            width={44}
            height={44}
            priority
          />
          <span className="text-xl font-bold text-[var(--text-primary)]">
            Wagzly
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--text-secondary)] md:flex">
          <a href="#features" className="hover:text-[var(--text-primary)]">
            Features
          </a>
          <a href="#pricing" className="hover:text-[var(--text-primary)]">
            Pricing
          </a>
          <a
            href={demoBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)]"
          >
            Book a demo
          </a>
        </nav>

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--divider-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm">
            Account
            <span className="text-xs text-[var(--text-secondary)]">▾</span>
          </summary>

          <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-[var(--divider-soft)] bg-white p-3 shadow-xl">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rose-primary)]">
              Wagzly Account
            </p>

            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--soft-surface)]"
            >
              Log in
            </Link>

            <Link
              href="/create-account"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--soft-surface)]"
            >
              Create account
            </Link>

            <Link
              href="/account"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--soft-surface)]"
            >
              Account & billing
            </Link>
          </div>
        </details>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6">
              <Image
                src="/images/logo/WagzlyHLarge.png"
                alt="Wagzly"
                width={320}
                height={90}
                priority
              />
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
              Mobile Grooming Software
            </p>

            <h1 className="mt-4 text-5xl font-bold leading-tight text-[var(--text-primary)]">
              Run your grooming business without the chaos
            </h1>

            <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
              Wagzly helps mobile groomers manage schedules, clients,
              onboarding, reminders, and payments — all in one clean, simple
              system.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/create-account" className="primary-button">
                Start 14-day trial
              </Link>

              <a
                href={demoBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-button"
              >
                Book a demo
              </a>
            </div>
          </div>

          <div className="soft-card p-6">
            <div className="rounded-2xl bg-[var(--soft-surface)] p-6 text-sm text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">
                Why groomers choose Wagzly
              </p>

              <ul className="mt-4 space-y-3">
                <li>✓ Keep your route and appointments organized</li>
                <li>✓ Collect onboarding forms before the visit</li>
                <li>✓ Send reminders and reduce no-shows</li>
                <li>✓ Track payments, tips, and unpaid balances</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-[var(--text-primary)]">
          Everything you need to run your grooming business
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Smart Scheduling", "Drag, drop, and manage your day with less effort."],
            ["Route Planning", "Know where to go next and stay efficient on the road."],
            ["Client Management", "Keep pet details, customer notes, and service history organized."],
            ["Automated Reminders", "Reduce no-shows with reminders and confirmations."],
            ["Payment Tracking", "Track collected payments, tips, and outstanding balances."],
            ["Designed for Groomers", "Built specifically for mobile grooming businesses."],
          ].map(([title, desc], i) => (
            <div key={i} className="soft-card p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-[var(--text-primary)]">
          Simple pricing
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--text-secondary)]">
          Start with a 14-day trial. No complicated setup, no long-term contract.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="soft-card p-6">
            <h3 className="text-xl font-bold">Basic</h3>
            <p className="mt-2 text-3xl font-bold">$39.99/mo</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
              <li>✓ 1 admin + 1 groomer</li>
              <li>✓ Scheduling tools</li>
              <li>✓ Client onboarding</li>
              <li>✓ Customer and pet profiles</li>
            </ul>
          </div>

          <div className="soft-card border-2 border-[var(--rose-primary)] p-6">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="mt-2 text-3xl font-bold">$89.99/mo</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
              <li>✓ Everything in Basic</li>
              <li>✓ SMS reminders</li>
              <li>✓ Advanced reporting</li>
              <li>✓ More automation features</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="soft-card p-10">
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">
            Ready to simplify your grooming business?
          </h2>

          <p className="mt-4 text-[var(--text-secondary)]">
            Create your Wagzly account, start your trial, and set up your
            grooming business profile.
          </p>

          <Link href="/create-account" className="primary-button mt-6 inline-block">
            Start 14-day trial
          </Link>
        </div>
      </section>
    </main>
  );
}