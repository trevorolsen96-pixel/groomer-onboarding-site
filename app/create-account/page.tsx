"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function CreateAccountPage() {
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
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-14">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
              Start your trial
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)]">
              Create your Wagzly business account
            </h1>

            <p className="mt-5 text-lg leading-8 text-[var(--text-secondary)]">
              Add your payment method now, start your 14-day trial today, and
              automatically continue with your monthly Wagzly subscription after
              the trial ends.
            </p>

            <div className="mt-6 rounded-3xl bg-white/70 p-5 shadow-sm">
              <p className="font-bold text-[var(--text-primary)]">
                Wagzly Basic
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                14 days free, then $39.99/month.
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Cancel before the trial ends to avoid being charged.
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
              {saving ? "Opening checkout..." : "Continue to secure checkout"}
            </button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[var(--rose-primary)]">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}