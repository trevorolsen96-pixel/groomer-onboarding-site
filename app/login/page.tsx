"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useState } from "react";
import { supabaseClient } from "../../lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <main
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-black/35 px-6 py-10"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
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
      </section>
    </main>
  );
}