"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabaseClient } from "../../lib/supabase-client";

export default function CreateAccountPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    const response = await fetch("/api/create-business-owner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName,
        businessName,
        phone,
        email,
        password,
        acceptedTerms,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSaving(false);
      setError(result.error ?? "Unable to create account.");
      return;
    }

    const { error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (loginError) {
      router.push("/login");
      return;
    }

    router.push("/account");
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
              Set up your owner account, create your business profile, and start
              your 14-day Wagzly trial.
            </p>

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

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Password
              </label>
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                type="password"
                placeholder="Create a password"
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
              {saving ? "Creating account..." : "Start 14-day trial"}
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