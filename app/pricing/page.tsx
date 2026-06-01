import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Wagzly",
  description:
    "Simple, transparent pricing for mobile grooming software. Wagzly Basic starts at $39.99/mo. Wagzly Pro at $89.99/mo. Both plans include a 14-day free trial.",
};

const basicFeatures = [
  "Full appointment scheduling",
  "Client & pet profiles with service history",
  "Route planning & calendar views",
  "Automated appointment reminders",
  "200 SMS / month",
  "1 staff account & 1 van",
];

const proFeatures = [
  "Everything in Basic",
  "900 SMS / month",
  "Unlimited staff accounts & vans",
  "Payment links & invoicing",
  "Expense & tip tracking",
  "Business snapshot & insights",
  "SMS credit pack add-ons",
];

const comparisonRows = [
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
  ["Data import (MoeGo & more)", "🐾", "🐾"],
];

export default function PricingPage() {
  return (
    <main className="site-shell">

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
          Pricing
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)] lg:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
          Every Wagzly plan includes the full scheduling system. Basic gives
          owner-operators the essentials, while Pro adds the tools you need to grow.
          Both plans include a 14-day free trial — no credit card required.
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Basic */}
          <div className="soft-card p-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Wagzly Basic</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Perfect for solo owner-operators</p>
            <p className="mt-5 text-4xl font-bold text-[var(--text-primary)]">$39.99<span className="text-lg font-medium text-[var(--text-secondary)]">/mo</span></p>
            <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">14-day free trial</p>
            <Link href="/create-account?plan=basic" className="secondary-button mt-6 block text-center">
              Start free trial
            </Link>
            <ul className="mt-7 space-y-3">
              {basicFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 font-bold text-[var(--rose-primary)]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="soft-card border-2 border-[var(--rose-primary)] p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Wagzly Pro</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">For growing grooming businesses</p>
              </div>
              <span className="rounded-full bg-[var(--rose-primary)] px-3 py-1 text-xs font-bold text-white">
                Most flexible
              </span>
            </div>
            <p className="mt-5 text-4xl font-bold text-[var(--text-primary)]">$89.99<span className="text-lg font-medium text-[var(--text-secondary)]">/mo</span></p>
            <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">14-day free trial</p>
            <Link href="/create-account?plan=pro" className="primary-button mt-6 block text-center">
              Start free trial
            </Link>
            <ul className="mt-7 space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 font-bold text-[var(--rose-primary)]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Comparison table */}
        <div className="mt-8 overflow-hidden rounded-3xl bg-white/70 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--soft-surface)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Feature</th>
                <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Basic</th>
                <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Pro</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([feature, basic, pro]) => (
                <tr key={feature} className="border-t border-black/5">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{feature}</td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">{basic}</td>
                  <td className="px-4 py-3 text-center font-bold text-[var(--text-secondary)]">{pro}</td>
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

      {/* FAQ */}
      <div className="bg-[var(--soft-surface)]">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-[var(--text-primary)]">Common questions</h2>
          <div className="mt-10 space-y-6">
            {[
              {
                q: "Do I need a credit card to start the free trial?",
                a: "No. You can start your 14-day free trial without entering any payment information. You'll only be asked for billing details if you decide to continue after the trial.",
              },
              {
                q: "Can I switch plans later?",
                a: "Yes, you can upgrade or downgrade your plan at any time from your account page.",
              },
              {
                q: "What happens when my trial ends?",
                a: "You'll be prompted to choose a plan and enter billing details. If you don't, your account will be paused — your data stays safe and you can reactivate anytime.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. There are no contracts or commitments. Cancel from your account page whenever you want.",
              },
              {
                q: "What are SMS credits used for?",
                a: "SMS credits are used for automated appointment reminders, confirmations, and direct messages to your clients. Basic includes 200/mo and Pro includes 900/mo. Additional packs are available on Pro.",
              },
              {
                q: "I'm switching from MoeGo — can I bring my client data?",
                a: "Yes. Wagzly includes a built-in import tool for MoeGo client and pet data. Log in, go to your account, and use the Import tab to bring your clients over in minutes.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="soft-card p-6">
                <p className="font-bold text-[var(--text-primary)]">{q}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="soft-card p-10">
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">Still have questions?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">
            Email us at{" "}
            <a href="mailto:support@wagzly.com" className="font-semibold text-[var(--rose-primary)] hover:underline">
              support@wagzly.com
            </a>{" "}
            and you'll hear back from a real person.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/create-account" className="primary-button">Start 14-day free trial</Link>
            <Link href="/features" className="secondary-button">See all features</Link>
          </div>
        </div>
      </section>

    </main>
  );
}
