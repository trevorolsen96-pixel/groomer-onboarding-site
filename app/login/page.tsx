"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useState } from "react";
import { supabaseClient } from "../../lib/supabase-client";

type Mode = "login" | "forgot" | "forgot_sent";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  function closeModal() {
    router.push("/");
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your email.");
      return;
    }

    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: signInError } =
      await supabaseClient.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (signInError || !data.user) {
      setSaving(false);
      setError("Email or password is incorrect.");
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, business_id, full_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabaseClient.auth.signOut();
      setSaving(false);
      setError("No Wagzly business owner account was found for this login.");
      return;
    }

    if (profile.role !== "admin") {
      await supabaseClient.auth.signOut();
      setSaving(false);
      setError(
        "Staff accounts are managed through the Wagzly mobile app. Please sign in through the app."
      );
      return;
    }

    router.push("/account");
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      // Always show success — never reveal whether the account exists
      setMode("forgot_sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-black/35 px-6 py-10"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">

        {/* ── Login ── */}
        {mode === "login" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                  Wagzly Account
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Log in to manage your Wagzly account, trial, and billing.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-3 py-1 text-2xl leading-none text-[var(--text-secondary)] hover:bg-[var(--soft-surface)]"
                aria-label="Close login"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setError("");
                      setMode("forgot");
                    }}
                    className="text-xs font-semibold text-[var(--rose-primary)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  type="password"
                  placeholder="Enter your password"
                  className="mt-2 w-full"
                />
              </div>

              {error ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={saving} className="primary-button w-full">
                {saving ? "Logging in..." : "Log in"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--divider-soft)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                New to Wagzly?
              </span>
              <div className="h-px flex-1 bg-[var(--divider-soft)]" />
            </div>

            <Link href="/create-account" className="secondary-button block text-center">
              Create business owner account
            </Link>
          </>
        ) : null}

        {/* ── Forgot password ── */}
        {mode === "forgot" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                  Wagzly Account
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  Reset password
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Enter your email and we&apos;ll send you a link to set a new password.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-3 py-1 text-2xl leading-none text-[var(--text-secondary)] hover:bg-[var(--soft-surface)]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="mt-7 space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Email
                </label>
                <input
                  value={forgotEmail}
                  onChange={(event) => {
                    setForgotEmail(event.target.value);
                    setError("");
                  }}
                  type="email"
                  placeholder="name@email.com"
                  className="mt-2 w-full"
                  autoFocus
                />
              </div>

              {error ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={saving} className="primary-button w-full">
                {saving ? "Sending..." : "Send reset email"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("login");
              }}
              className="mt-5 w-full text-center text-sm font-semibold text-[var(--rose-primary)] hover:underline"
            >
              ← Back to login
            </button>
          </>
        ) : null}

        {/* ── Sent confirmation ── */}
        {mode === "forgot_sent" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                  Wagzly Account
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  Check your email
                </h1>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-3 py-1 text-2xl leading-none text-[var(--text-secondary)] hover:bg-[var(--soft-surface)]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              If <strong className="text-[var(--text-primary)]">{forgotEmail}</strong> is
              linked to a Wagzly account, you&apos;ll receive a password reset email
              from <strong className="text-[var(--text-primary)]">support@wagzly.com</strong> shortly.
              The link expires in 24 hours.
            </p>

            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode("forgot");
                }}
                className="font-semibold text-[var(--rose-primary)] hover:underline"
              >
                try again
              </button>
              .
            </p>

            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("login");
              }}
              className="mt-6 w-full text-center text-sm font-semibold text-[var(--rose-primary)] hover:underline"
            >
              ← Back to login
            </button>
          </>
        ) : null}

      </section>
    </main>
  );
}