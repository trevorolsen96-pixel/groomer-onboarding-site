"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type WagzlyPlan = "basic" | "pro";

const comparisonRows = [
  ["Full appointment scheduling", "paw", "paw"],
  ["Calendar views", "paw", "paw"],
  ["Customer & pet profiles", "paw", "paw"],
  ["Services, add-ons, notes & flags", "paw", "paw"],
  ["Appointment reminders", "paw", "paw"],
  ["Staff / groomers", "1", "Unlimited"],
  ["Vehicles / vans", "1", "Unlimited"],
  ["SMS credits", "200/mo", "900/mo"],
  ["Payment links", "—", "paw"],
  ["Expenses / finance tools", "—", "paw"],
  ["Message pack add-ons", "—", "paw"],
];

export default function CreateAccountPage() {
  const [selectedPlan, setSelectedPlan] = useState<WagzlyPlan>("basic");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    const response = await fetch("/api/stripe/create-owner-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: selectedPlan,
        fullName,
        businessName,
        phone,
        email,
        acceptedTerms,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSaving(false);
      setError(result.error ?? "Unable to start checkout.");
      return;
    }

    if (!result.url) {
      setSaving(false);
      setError("Stripe checkout did not return a checkout link.");
      return;
    }

    window.location.href = result.url;
  }

  return (
    <main className="site-shell">
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Start your trial
          </p>

          <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)]">
            Create your Wagzly business account
          </h1>

          <p className="mt-5 text-lg leading-8 text-[var(--text-secondary)]">
            Every Wagzly plan includes the full scheduling system. Basic is
            built for solo groomers. Pro adds growth tools for teams, multiple
            vans, payments, and more texting power.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <PlanCard
            selected={selectedPlan === "basic"}
            title="Wagzly Basic"
            price="$39.99/month"
            subtitle="Best for solo groomers"
            description="Full scheduling, customers, pets, services, reminders, and daily tools for one groomer."
            onClick={() => setSelectedPlan("basic")}
          />

          <PlanCard
            selected={selectedPlan === "pro"}
            title="Wagzly Pro"
            price="$89.99/month"
            subtitle="Best for growing grooming teams"
            description="Everything in Basic, plus unlimited staff, unlimited vans, payment links, finance tools, and more SMS credits."
            badge="Most flexible"
            onClick={() => setSelectedPlan("pro")}
          />
        </div>

        <div className="mt-6 rounded-3xl bg-white/70 p-5 shadow-sm">
          <p className="font-bold text-[var(--text-primary)]">
            Both plans include a 14-day free trial.
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Add your payment method now, start your trial today, and continue
            automatically after the trial ends. Cancel before the trial ends to
            avoid being charged.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-white/70 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Compare Basic and Pro
          </h2>

          <div className="mt-4 overflow-hidden rounded-2xl border border-black/5">
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
                {comparisonRows.map(([feature, basic, pro]) => (
                  <tr key={feature} className="border-t border-black/5">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {feature}
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                      <FeatureValue value={basic} />
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                      <FeatureValue value={pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="rounded-3xl bg-white/70 p-5 shadow-sm">
              <p className="font-bold text-[var(--text-primary)]">
                Selected plan
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--rose-primary)]">
                Wagzly {selectedPlan === "basic" ? "Basic" : "Pro"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                14 days free, then{" "}
                {selectedPlan === "basic" ? "$39.99/month" : "$89.99/month"}.
              </p>
            </div>

            <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">
              Staff accounts should not sign up here. Staff members must use
              their invite link.
            </p>
          </div>

          <form onSubmit={handleCreateAccount} className="soft-card space-y-4 p-7">
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Full name
              </label>
              <input
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setError("");
                }}
                placeholder="Your name"
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Business name
              </label>
              <input
                value={businessName}
                onChange={(event) => {
                  setBusinessName(event.target.value);
                  setError("");
                }}
                placeholder="Example: Happy Paws Mobile Grooming"
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Business phone
              </label>
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError("");
                }}
                placeholder="(555) 555-5555"
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Email
              </label>
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                type="email"
                placeholder="name@email.com"
                className="mt-2 w-full"
              />
            </div>

            <label className="flex gap-3 rounded-2xl bg-[var(--soft-surface)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked);
                  setError("");
                }}
                className="mt-1"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-semibold text-[var(--rose-primary)]">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-semibold text-[var(--rose-primary)]">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={saving} className="primary-button w-full">
              {saving
                ? "Opening checkout..."
                : `Continue with Wagzly ${
                    selectedPlan === "basic" ? "Basic" : "Pro"
                  }`}
            </button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[var(--rose-primary)]">
                Log in
              </Link>
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}

function PlanCard({
  selected,
  title,
  price,
  subtitle,
  description,
  badge,
  onClick,
}: {
  selected: boolean;
  title: string;
  price: string;
  subtitle: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-3xl p-6 text-left shadow-sm transition ${
        selected
          ? "bg-white ring-2 ring-[var(--rose-primary)]"
          : "bg-white/70 ring-1 ring-black/5 hover:bg-white"
      }`}
    >
      {badge ? (
        <span className="absolute right-5 top-5 rounded-full bg-[var(--rose-primary)] px-3 py-1 text-xs font-bold text-white">
          {badge}
        </span>
      ) : null}

      <p className="text-2xl font-bold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
        {price}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--rose-primary)]">
        14-day free trial
      </p>
      <p className="mt-5 font-bold text-[var(--text-primary)]">{subtitle}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
    </button>
  );
}

function FeatureValue({ value }: { value: string }) {
  if (value === "paw") {
    return <span className="text-lg">🐾</span>;
  }

  if (value === "—") {
    return <span className="text-black/30">—</span>;
  }

  return <span className="font-bold text-[var(--text-primary)]">{value}</span>;
}