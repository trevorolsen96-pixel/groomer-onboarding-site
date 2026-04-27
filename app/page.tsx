import Image from "next/image";

const demoBookingUrl = "https://wagzly.zohobookings.com/#/4937476000000034049";

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="mx-auto max-w-6xl px-6 py-20">
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
              <a
                href={demoBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button"
              >
                Book a demo
              </a>

              <a href="#pricing" className="secondary-button">
                View pricing
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

      <section className="mx-auto max-w-6xl px-6 py-16">
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

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-[var(--text-primary)]">
          What groomers are saying
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {[
            "Wagzly helped me clean up my entire scheduling process.",
            "I finally have one place for appointments, notes, and payments.",
            "The reminders alone save me a ton of time every week.",
            "This feels like it was made specifically for how mobile groomers work.",
          ].map((text, i) => (
            <div key={i} className="soft-card p-5">
              <p className="text-[var(--text-secondary)]">“{text}”</p>
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                — Wagzly User
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="soft-card p-10">
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">
            Ready to simplify your grooming business?
          </h2>
          <p className="mt-4 text-[var(--text-secondary)]">
            Book a demo and see how Wagzly can help you save time, stay
            organized, and grow.
          </p>

          <a
            href={demoBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-button mt-6 inline-block"
          >
            Book a demo
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20 text-center">
        <div className="soft-card p-8">
          <div className="mx-auto mb-4 flex justify-center">
            <Image
              src="/images/logo/WagzlyApp.png"
              alt="Wagzly app icon"
              width={72}
              height={72}
            />
          </div>

          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            Get updates and grooming business tips
          </h3>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Join the Wagzly newsletter for product updates, release news, and
            grooming business tips.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <input placeholder="Enter your email" className="w-full max-w-xs" />
            <button className="primary-button">Subscribe</button>
          </div>
        </div>
      </section>
    </main>
  );
}