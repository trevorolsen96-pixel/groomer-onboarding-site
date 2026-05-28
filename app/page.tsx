import Image from "next/image";
import Link from "next/link";
import AccountMenu from "../components/AccountMenu";
import HomeCtas from "../components/HomeCtas";

const demoBookingUrl = "https://calendar.app.google/wwNEKQs1KnJEaxbz6";

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
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
          <a href="#download" className="hover:text-[var(--text-primary)]">
            Download
          </a>
        </nav>

        <AccountMenu />
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
              onboarding, reminders, and payments &mdash; all in one clean,
              simple system.
            </p>

            <HomeCtas demoBookingUrl={demoBookingUrl} />
          </div>

          <div className="soft-card p-6">
            <div className="rounded-2xl bg-[var(--soft-surface)] p-6 text-sm text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">
                Why groomers choose Wagzly
              </p>
              <ul className="mt-4 space-y-3">
                <li>&#10003; Keep your route and appointments organized</li>
                <li>&#10003; Collect onboarding forms before the visit</li>
                <li>&#10003; Send reminders and reduce no-shows</li>
                <li>&#10003; Track payments, tips, and unpaid balances</li>
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
          {features.map(({ title, desc, icon }) => (
            <div key={title} className="soft-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--soft-surface)] text-[var(--rose-primary)]">
                {icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
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
          Every Wagzly plan includes the full scheduling system. Basic gives
          owner-operators the essentials, while Pro adds tools to help you grow.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="soft-card p-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              Wagzly Basic
            </h3>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
              $39.99/mo
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">
              14-day free trial
            </p>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              Everything you need to run your grooming business with
              appointments, customers, pets, reminders, and daily scheduling
              tools.
            </p>
          </div>

          <div className="soft-card border-2 border-[var(--rose-primary)] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  Wagzly Pro
                </h3>
                <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  $89.99/mo
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">
                  14-day free trial
                </p>
              </div>
              <span className="rounded-full bg-[var(--rose-primary)] px-3 py-1 text-xs font-bold text-white">
                Most flexible
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              Everything in Basic, plus more texting power, payment tools,
              unlimited staff, unlimited vans, and features designed to help
              you scale.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl bg-white/70 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--soft-surface)]">
              <tr>
                <th className="px-4 py-3 text-left text-[var(--text-primary)]">
                  Feature
                </th>
                <th className="px-4 py-3 text-center text-[var(--text-primary)]">
                  Basic
                </th>
                <th className="px-4 py-3 text-center text-[var(--text-primary)]">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Full appointment scheduling", "🐾", "🐾"],
                ["Calendar views", "🐾", "🐾"],
                ["Customer & pet profiles", "🐾", "🐾"],
                ["Services, add-ons, notes & flags", "🐾", "🐾"],
                ["Appointment reminders", "🐾", "🐾"],
                ["Staff / groomers", "1", "Unlimited"],
                ["Vehicles / vans", "1", "Unlimited"],
                ["SMS credits", "200/mo", "900/mo"],
                ["Payment links", "—", "🐾"],
                ["Expenses / finance tools", "—", "🐾"],
                ["Message pack add-ons", "—", "🐾"],
              ].map(([feature, basic, pro]) => (
                <tr key={feature} className="border-t border-black/5">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                    {feature}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">
                    {basic}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">
                    {pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/create-account" className="primary-button">
            Start your 14-day trial
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <div className="soft-card p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Built for mobile groomers
          </p>

          <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
            Ready to simplify your grooming business?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            Start your trial and see how Wagzly can help organize your
            schedule, clients, pets, onboarding, reminders, and payments.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ValueCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              title="14-day free trial"
              body="Explore every feature of your plan before you are ever charged. No surprises."
            />
            <ValueCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              }
              title="Cancel anytime"
              body="No contracts, no commitments. Cancel from your account page whenever you want."
            />
            <ValueCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              }
              title="Real support"
              body="Email us at support@wagzly.com and you will hear back from a real person."
            />
          </div>

          <div className="mt-8 flex justify-center">
            <HomeCtas demoBookingUrl={demoBookingUrl} showDemoCard={false} />
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-5xl scroll-mt-28 px-6 pb-16 pt-4 text-center">
        <div className="soft-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            iOS and Android
          </p>

          <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
            Take Wagzly with you on every grooming day.
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Wagzly is designed for supported iPhone and Android devices, so
            you can manage appointments, clients, pets, and payments wherever
            the day takes you.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-5">
            <div className="flex h-[54px] w-[180px] items-center justify-center">
              <Image
                src="/images/store/appstore.svg"
                alt="Download on the App Store"
                width={180}
                height={54}
                className="h-[54px] w-[180px] object-contain"
              />
            </div>
            <div className="flex h-[54px] w-[180px] items-center justify-center">
              <Image
                src="/images/store/googleplay.png"
                alt="Get it on Google Play"
                width={180}
                height={54}
                className="h-[54px] w-[180px] object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-[var(--divider-soft)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--text-secondary)]">
          <p>&copy; {new Date().getFullYear()} Wagzly. All rights reserved.</p>
          <nav className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-[var(--text-primary)]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-primary)]">
              Terms of Service
            </Link>
            <a
              href="mailto:support@wagzly.com"
              className="hover:text-[var(--text-primary)]"
            >
              support@wagzly.com
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function ValueCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl bg-[var(--soft-surface)] p-5 text-left">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--rose-primary)] shadow-sm">
        {icon}
      </div>
      <p className="mt-4 text-base font-bold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {body}
      </p>
    </div>
  );
}

const features: { title: string; desc: string; icon: React.ReactNode }[] = [
  {
    title: "Smart Scheduling",
    desc: "Drag, drop, and manage your day with less effort.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    title: "Route Planning",
    desc: "Know where to go next and stay efficient on the road.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: "Client Management",
    desc: "Keep pet details, customer notes, and service history organized.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    title: "Automated Reminders",
    desc: "Reduce no-shows with SMS reminders and appointment confirmations.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    title: "Payment Tracking",
    desc: "Track collected payments, tips, and outstanding balances.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
  },
  {
    title: "Designed for Groomers",
    desc: "Built specifically for mobile grooming businesses, not adapted from something generic.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
      </svg>
    ),
  },
];
