"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { supabaseClient } from "../../../lib/supabase-client";

export default function FinishCreateAccountPage() {
  return (
    <Suspense fallback={<FinishLoading />}>
      <FinishCreateAccountContent />
    </Suspense>
  );
}

function FinishLoading() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-14">
        <div className="soft-card w-full p-8">
          <p className="font-bold text-[var(--text-primary)]">
            Loading checkout...
          </p>
        </div>
      </section>
    </main>
  );
}

function FinishCreateAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFinishAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionId) {
      setError("Missing checkout session. Please start again.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    const response = await fetch("/api/create-business-owner-after-stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSaving(false);
      setError(result.error ?? "Unable to finish creating your account.");
      return;
    }

    const { error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: result.email,
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
              Finish setup
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)]">
              Create your Wagzly password
            </h1>

            <p className="mt-5 text-lg leading-8 text-[var(--text-secondary)]">
              Your payment method is saved and your 14-day trial is ready. Create
              your password to finish setting up your Wagzly business account.
            </p>
          </div>

          <form onSubmit={handleFinishAccount} className="soft-card space-y-4 p-7">
            {!sessionId ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                Missing checkout session. Please restart account setup.
              </p>
            ) : null}

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

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Confirm password
              </label>
              <input
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                }}
                type="password"
                placeholder="Confirm your password"
                className="mt-2 w-full"
              />
            </div>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving || !sessionId}
              className="primary-button w-full"
            >
              {saving ? "Creating account..." : "Finish account setup"}
            </button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              Already finished?{" "}
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