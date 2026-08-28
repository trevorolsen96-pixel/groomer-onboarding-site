import Image from "next/image";
import Link from "next/link";
import HomeCtas from "../components/HomeCtas";
import Reveal from "../components/Reveal";
import FaqAccordion from "../components/FaqAccordion";
import { faqs } from "../lib/faq-data";

const demoBookingUrl = "https://calendar.app.google/wwNEKQs1KnJEaxbz6";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

export default function HomePage() {
  return (
    <main className="site-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          className="bg-blob h-72 w-72 opacity-25"
          style={{ top: "-4rem", left: "-6rem", background: "var(--mauve-secondary)" }}
        />
        <div
          className="bg-blob h-96 w-96 opacity-20"
          style={{ top: "2rem", right: "-8rem", background: "var(--rose-primary)" }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-8 lg:pb-24 lg:pt-14">
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

              <p className="eyebrow">Mobile Grooming Software</p>

              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                Run your grooming business{" "}
                <span className="gradient-text">without the chaos</span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--text-secondary)]">
                Wagzly helps mobile groomers manage schedules, clients,
                onboarding, reminders, and payments, all in one clean,
                simple app.
              </p>

              <HomeCtas demoBookingUrl={demoBookingUrl} />
            </div>

            <div className="relative flex items-center justify-center">
              <Image
                src="/images/app/banner.png"
                alt="Wagzly app in action"
                width={640}
                height={360}
                className="w-full rounded-3xl shadow-2xl"
                priority
              />

              <div className="float-chip -bottom-4 left-2 max-w-[85%] text-xs sm:-bottom-6 sm:left-4 sm:max-w-none sm:text-sm">
                <span className="float-dot shrink-0" />
                <span className="font-semibold text-[var(--text-primary)]">
                  Reminder confirmed by client
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Find a Groomer CTA ── */}
      <div className="bg-[var(--soft-surface)]">
        <section className="mx-auto max-w-6xl px-6 py-14">
          <Reveal className="soft-card overflow-hidden p-0">
            <div className="grid items-center gap-0 lg:grid-cols-2">
              <div className="p-8 lg:p-12">
                <p className="eyebrow">For pet owners</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--text-primary)]">
                  Find a mobile groomer near you
                </h2>
                <p className="mt-4 text-[var(--text-secondary)] leading-7">
                  Browse Wagzly-powered groomers in your area, view their services, and request an appointment, entirely online.
                </p>
                <div className="mt-7 flex flex-wrap gap-4">
                  <Link
                    href="/book"
                    className="primary-button inline-flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    Find a Groomer
                  </Link>
                </div>
                <div className="mt-6 flex flex-wrap gap-5">
                  {[
                    "Search by zip code",
                    "Book online 24/7",
                    "Request your preferred time",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--rose-primary)]">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center bg-[var(--soft-surface)] p-10 lg:h-full">
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-md">
                    <span className="text-5xl">🐾</span>
                  </div>
                  <p className="mt-5 text-xl font-bold text-[var(--text-primary)]">Your dog deserves the best</p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Mobile groomers come to you, with no travel stress for your pet.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* ── Features ── */}
      <div className="bg-[var(--soft-surface)]">
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <Reveal className="text-center">
            <p className="eyebrow justify-center">What&apos;s inside</p>
            <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
              Everything you need to run your grooming business
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bentoFeatures.map(({ title, desc, icon, span, preview }, i) => (
              <Reveal
                key={title}
                delay={i * 80}
                className={`bento-card p-6 ${span ?? ""}`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--soft-surface)] text-[var(--rose-primary)]">
                  {icon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{desc}</p>
                {preview}
              </Reveal>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/features" className="secondary-button inline-flex items-center gap-2">
              See all features
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>

      {/* ── App screenshots ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="text-center">
          <p className="eyebrow justify-center">The app</p>
          <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            See Wagzly in action
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--text-secondary)]">
            A clean, focused experience built for busy grooming days.
          </p>
        </Reveal>

        {/* Mobile: horizontal scroll carousel */}
        <div className="mt-14 sm:hidden">
          <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 px-6" style={{scrollbarWidth: "none"}}>
            {[
              { src: "/images/app/screen-clients.png", label: "Clients & Pets", alt: "Clients and Pets screen" },
              { src: "/images/app/screen-dashboard.png", label: "Dashboard", alt: "Dashboard screen", featured: true },
              { src: "/images/app/screen-schedule.png", label: "Schedule", alt: "Schedule screen" },
            ].map((screen) => (
              <div key={screen.src} className="flex shrink-0 snap-center flex-col items-center gap-3">
                <div className={`w-52 overflow-hidden rounded-[2.5rem] border-[5px] border-gray-900 bg-gray-900 ${screen.featured ? "shadow-2xl ring-4 ring-[var(--rose-primary)]/20" : "shadow-xl"}`}>
                  <Image src={screen.src} alt={screen.alt} width={706} height={1494} className="block w-full" />
                </div>
                <p className={`text-sm font-semibold ${screen.featured ? "text-[var(--rose-primary)]" : "text-[var(--text-secondary)]"}`}>{screen.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-[var(--text-secondary)]">← swipe to explore →</p>
        </div>

        {/* Desktop: tilted layout */}
        <div className="mt-14 hidden items-end justify-center gap-6 lg:gap-10 sm:flex">
          <div className="flex flex-col items-center gap-3" style={{transform: "rotate(-5deg) translateY(20px)"}}>
            <div className="w-44 overflow-hidden rounded-[2.5rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl">
              <Image src="/images/app/screen-clients.png" alt="Clients and Pets screen" width={706} height={1494} className="block w-full" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Clients &amp; Pets</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-52 overflow-hidden rounded-[2.5rem] border-[5px] border-gray-900 bg-gray-900 shadow-2xl ring-4 ring-[var(--rose-primary)]/20">
              <Image src="/images/app/screen-dashboard.png" alt="Dashboard screen" width={706} height={1494} className="block w-full" />
            </div>
            <p className="text-sm font-semibold text-[var(--rose-primary)]">Dashboard</p>
          </div>
          <div className="flex flex-col items-center gap-3" style={{transform: "rotate(5deg) translateY(20px)"}}>
            <div className="w-44 overflow-hidden rounded-[2.5rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl">
              <Image src="/images/app/screen-schedule.png" alt="Schedule screen" width={706} height={1494} className="block w-full" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Schedule</p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <div className="bg-[var(--soft-surface)]">
        <section className="mx-auto max-w-6xl px-6 py-16">
          <Reveal className="text-center">
            <p className="eyebrow justify-center">Getting started</p>
            <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
              Up and running in minutes
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {steps.map(({ number, title, desc }, i) => (
              <Reveal key={number} delay={i * 100} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--rose-primary)] text-sm font-bold text-white">
                  {number}
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{desc}</p>
              </Reveal>
            ))}
          </div>
        </section>
      </div>

      {/* ── Built for Teams ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="text-center">
          <p className="eyebrow justify-center">Two roles, one platform</p>
          <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            Built for how grooming businesses actually work
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            The business owner manages everything. The groomer sees only what they
            need to get through their day. Each person gets their own login with the
            right level of access.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal className="soft-card p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-2xl">
              👔
            </div>
            <h3 className="mt-5 text-xl font-bold text-[var(--text-primary)]">Business Owner</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Full control over your grooming business from one dashboard.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Manage all appointments and scheduling",
                "View and edit client & pet records",
                "Track finances, payments, and expenses",
                "Manage fleet vehicles and mileage reports",
                "Configure business settings and SMS",
                "Invite groomers and manage staff access",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100} className="soft-card p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-2xl">
              ✂️
            </div>
            <h3 className="mt-5 text-xl font-bold text-[var(--text-primary)]">Groomer</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              A focused view of their schedule, with no distractions or clutter.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "View their own appointments for the day",
                "See their weekly schedule at a glance",
                "Access route maps and navigation",
                "Clock in and out of appointments",
                "Cannot view other groomers' schedules",
                "Cannot access finances or business settings",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--text-secondary)]">
            Every Wagzly plan includes the full scheduling system. Basic gives
            your team the essentials, while Pro adds tools to help you scale.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal className="soft-card p-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Wagzly Basic</h3>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">$39.99/mo</p>
            <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">14-day free trial</p>
            <ul className="mt-5 space-y-2.5">
              {basicFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 font-bold text-[var(--rose-primary)]">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            delay={100}
            className="relative overflow-hidden rounded-[22px] border-2 border-[var(--rose-primary)] bg-[var(--warm-surface)] p-6 shadow-[0_20px_48px_rgba(197,143,161,0.28)]"
          >
            <div
              className="bg-blob h-40 w-40 opacity-30"
              style={{ top: "-3rem", right: "-3rem", background: "var(--rose-primary)" }}
            />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">Wagzly Pro</h3>
                  <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">$89.99/mo</p>
                  <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">14-day free trial</p>
                </div>
                <span className="rounded-full bg-[var(--rose-primary)] px-3 py-1 text-xs font-bold text-white">
                  Most flexible
                </span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="mt-0.5 font-bold text-[var(--rose-primary)]">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={150} className="mt-6 overflow-hidden rounded-3xl bg-white/70 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--soft-surface)]">
              <tr>
                <th className="px-4 py-3 text-left text-[var(--text-primary)]">Feature</th>
                <th className="px-4 py-3 text-center text-[var(--text-primary)]">Basic</th>
                <th className="px-4 py-3 text-center text-[var(--text-primary)]">Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Full appointment scheduling", "🐾", "🐾"],
                ["Calendar views", "🐾", "🐾"],
                ["Customer & pet profiles", "🐾", "🐾"],
                ["Services, add-ons, notes & flags", "🐾", "🐾"],
                ["Appointment reminders", "🐾", "🐾"],
                ["Mileage tracking", "🐾", "🐾"],
                ["Team accounts", "2 (1 owner + 1 groomer)", "Unlimited"],
                ["Vehicles / vans", "1", "Unlimited"],
                ["SMS credits", "400/mo", "1500/mo"],
                ["Payment links", "—", "🐾"],
                ["Expenses / finance tools", "—", "🐾"],
                ["Message pack add-ons", "—", "🐾"],
                ["Data import (MoeGo & more)", "🐾", "🐾"],
              ].map(([feature, basic, pro]) => (
                <tr key={feature} className="border-t border-black/5">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{feature}</td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">{basic}</td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/create-account" className="primary-button">
            Start your 14-day trial
          </Link>
          <Link href="/pricing" className="secondary-button inline-flex items-center gap-2">
            Full pricing details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <div className="bg-[var(--soft-surface)]">
        <section className="mx-auto max-w-6xl px-6 py-16">
          <Reveal className="text-center">
            <p className="eyebrow justify-center">Questions</p>
            <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
              Frequently asked questions
            </h2>
          </Reveal>
          <FaqAccordion />
        </section>
      </div>

      {/* ── CTA / Value props ── */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <Reveal className="soft-card p-10">
          <p className="eyebrow justify-center">Built for mobile groomers</p>
          <h2 className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
            Ready to simplify your grooming business?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            Start your trial and see how Wagzly can help organize your schedule,
            clients, pets, onboarding, reminders, and payments.
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
        </Reveal>
      </section>

      {/* ── Download ── */}
      <section id="download" className="mx-auto max-w-5xl scroll-mt-28 px-6 pb-16 pt-4 text-center">
        <Reveal className="soft-card p-8">
          <p className="eyebrow justify-center">iOS and Android</p>
          <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
            Take Wagzly with you on every grooming day.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Wagzly is designed for supported iPhone and Android devices, so you
            can manage appointments, clients, pets, and payments wherever the
            day takes you.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-5">
            <a
              href="https://apps.apple.com/us/app/wagzly/id6775014396"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[54px] w-[180px] items-center justify-center"
            >
              <Image
                src="/images/store/appstore.svg"
                alt="Download on the App Store"
                width={180}
                height={54}
                className="h-[54px] w-[180px] object-contain"
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.wagzly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[54px] w-[180px] items-center justify-center"
            >
              <Image
                src="/images/store/googleplay.png"
                alt="Get it on Google Play"
                width={180}
                height={54}
                className="h-[54px] w-[180px] object-contain"
              />
            </a>
          </div>
        </Reveal>
      </section>

    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────

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
      <p className="mt-4 text-base font-bold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────

const steps = [
  {
    number: "1",
    title: "Create your account",
    desc: "Sign up and your 14-day free trial starts immediately. No setup fees, no contracts.",
  },
  {
    number: "2",
    title: "Set up your schedule",
    desc: "Add your clients, pets, and services. Build your first day of appointments in minutes.",
  },
  {
    number: "3",
    title: "Run your grooming day",
    desc: "Manage appointments, send reminders, collect payments, and message clients from one place.",
  },
];

const basicFeatures = [
  "Full appointment scheduling",
  "Client & pet profiles with service history",
  "Route planning & calendar views",
  "Mileage tracking for tax reporting",
  "Automated appointment reminders",
  "400 SMS / month",
  "2 accounts (1 business owner + 1 groomer)",
  "1 van",
];

const proFeatures = [
  "Everything in Basic",
  "1500 SMS / month",
  "Unlimited staff accounts & vans",
  "Payment links & invoicing",
  "Expense & tip tracking",
  "Business snapshot & insights",
  "SMS credit pack add-ons",
];

const bentoFeatures: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  span?: string;
  preview?: React.ReactNode;
}[] = [
  {
    title: "Smart Scheduling",
    desc: "Drag-and-drop day, week, and list views with conflict checks built in, so you can see your whole team's day at a glance.",
    span: "sm:col-span-2 lg:col-span-2",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    preview: (
      <div className="mt-5 space-y-2">
        <div className="preview-row">
          <span className="preview-label">9:00</span>
          <span className="preview-value">Bella · Full Groom · Confirmed</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">11:30</span>
          <span className="preview-value">Max · Bath &amp; Brush · Checked in</span>
        </div>
      </div>
    ),
  },
  {
    title: "Route Planning",
    desc: "Live drive-time estimates between stops keep your day realistic, not just idealistic.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: "Client & Pet Profiles",
    desc: "Breed, notes, behavior flags, and full service history, all before the leash changes hands.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    title: "Automated Reminders",
    desc: "SMS and push reminders go out on their own, with opt-out handled for you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    preview: (
      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-[var(--divider-soft)] bg-white/90 px-4 py-3">
        <span className="float-dot" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Reminder confirmed
        </span>
      </div>
    ),
  },
  {
    title: "Payment Tracking",
    desc: "Stripe-powered payment links, tips, and outstanding balances tracked automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
  },
  {
    title: "Designed for Mobile Groomers",
    desc: "Built specifically for mobile grooming businesses, not adapted from something generic.",
    span: "sm:col-span-2 lg:col-span-3",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
      </svg>
    ),
  },
];
