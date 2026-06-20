import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Features | Mobile Grooming Software",
  description:
    "Explore everything Wagzly offers — smart scheduling, route planning, client & pet management, automated SMS reminders, online payments, and more. Built specifically for mobile groomers.",
};

export default function FeaturesPage() {
  return (
    <main className="site-shell">

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
          Everything you need
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)] lg:text-5xl">
          Built for mobile groomers,<br className="hidden sm:block" /> not adapted from something generic
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
          Every feature in Wagzly was designed around how a mobile grooming business actually runs —
          from the first appointment of the day to getting paid at the last stop.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/create-account" className="primary-button">Start 14-day free trial</Link>
          <Link href="/pricing" className="secondary-button">See pricing</Link>
        </div>
      </section>

      {/* Feature sections */}
      <div className="space-y-6 pb-20">

        {/* Scheduling */}
        <div className="bg-[var(--soft-surface)]">
          <section className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Smart Scheduling</h2>
                <p className="mt-4 text-[var(--text-secondary)] leading-7">
                  Your schedule is the heartbeat of your business. Wagzly makes it easy to book,
                  move, and manage appointments without the back-and-forth. See your full day at a
                  glance, drag appointments to reschedule, and handle last-minute changes without losing your flow.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    "Daily, weekly, and calendar views",
                    "Drag-and-drop rescheduling",
                    "Multiple service types per appointment",
                    "Add-ons, notes, and flags per visit",
                    "Color-coded appointment statuses",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <Image src="/images/app/screen-schedule.png" alt="Wagzly scheduling screen" width={280} height={560} className="rounded-[2.5rem] border-[5px] border-gray-900 shadow-2xl" />
              </div>
            </div>
          </section>
        </div>

        {/* Client & Pet Management */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 flex justify-center lg:order-1">
              <Image src="/images/app/screen-clients.png" alt="Wagzly clients screen" width={280} height={560} className="rounded-[2.5rem] border-[5px] border-gray-900 shadow-2xl" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Client &amp; Pet Management</h2>
              <p className="mt-4 text-[var(--text-secondary)] leading-7">
                Every client and every pet gets their own profile. Track grooming history, special
                instructions, behavioral flags, and contact details all in one place. No more
                digging through notes apps or trying to remember which dog needs the sensitive shampoo.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Full client & pet profiles",
                  "Grooming history per pet",
                  "Behavioral flags and care notes",
                  "Multiple pets per client",
                  "Active and inactive status tracking",
                  "Import from MoeGo and other software",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Route Planning */}
        <div className="bg-[var(--soft-surface)]">
          <section className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Route Planning</h2>
                <p className="mt-4 text-[var(--text-secondary)] leading-7">
                  Mobile grooming means you're on the road all day. Wagzly shows you where your
                  appointments are and helps you stay efficient between stops. Spend less time
                  driving in circles and more time doing what you're good at.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    "Map view of your daily stops",
                    "Address stored per client",
                    "Navigate directly from the app",
                    "Multi-van route visibility for teams",
                    "Mileage tracking per vehicle for tax reporting",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-white shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-24 w-24 text-[var(--rose-primary)]/30">
                    <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Automated Reminders */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 flex justify-center lg:order-1">
              <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-white shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-24 w-24 text-[var(--rose-primary)]/30">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Automated Reminders</h2>
              <p className="mt-4 text-[var(--text-secondary)] leading-7">
                No-shows are one of the biggest time-wasters in a grooming business. Wagzly
                automatically sends SMS reminders to your clients before their appointment so
                they show up on time — and you don't have to make a single phone call.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Automatic SMS appointment reminders",
                  "Appointment confirmation messages",
                  "Care reminders for returning clients",
                  "200–900+ SMS credits per month depending on plan",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Payments */}
        <div className="bg-[var(--soft-surface)]">
          <section className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                  </svg>
                </div>
                <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Payment &amp; Finance Tracking</h2>
                <p className="mt-4 text-[var(--text-secondary)] leading-7">
                  Know exactly what you've earned, what's outstanding, and where your money is going.
                  Wagzly Pro includes payment links, expense tracking, and tip recording so your
                  finances stay organized without needing a separate spreadsheet.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    "Track collected payments per appointment",
                    "Send payment links to clients (Pro)",
                    "Tip tracking",
                    "Expense logging (Pro)",
                    "Business snapshot & revenue insights (Pro)",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-white shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-24 w-24 text-[var(--rose-primary)]/30">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Data Import */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 flex justify-center lg:order-1">
              <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-white shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-24 w-24 text-[var(--rose-primary)]/30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Data Import Tools</h2>
              <p className="mt-4 text-[var(--text-secondary)] leading-7">
                Switching to Wagzly doesn't mean starting over. Import your existing client and
                pet data directly from other grooming software so you're up and running on day one —
                not spending weeks manually re-entering hundreds of records.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Import clients & pets from MoeGo",
                  "GroomMore import coming soon",
                  "Duplicate detection — no double entries",
                  "Active and inactive clients both imported",
                  "Step-by-step guided import process",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--rose-primary)]">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

      </div>

      {/* Bottom CTA */}
      <div className="bg-[var(--soft-surface)]">
        <section className="mx-auto max-w-4xl px-6 py-16 text-center">
          <div className="soft-card p-10">
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">
              Try every feature free for 14 days. No credit card required to start.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/create-account" className="primary-button">Start 14-day free trial</Link>
              <Link href="/pricing" className="secondary-button">Compare plans</Link>
            </div>
          </div>
        </section>
      </div>

    </main>
  );
}
