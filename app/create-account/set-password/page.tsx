"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "../../../lib/supabase-client";

type PageState = "verifying" | "ready" | "invalid" | "success";

export default function SetPasswordPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase detects the #access_token=... hash automatically on load.
    // The PASSWORD_RECOVERY event fires when the hash is for a recovery link.
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setPageState("ready");
      } else if (event === "SIGNED_IN" && session) {
        // Already signed in (e.g. page refresh after recovery link was used)
        setPageState("ready");
      }
    });

    // Also check if a session already exists (in case the event already fired)
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPageState("ready");
      }
    });

    // After a short wait, if still verifying, the link may be invalid/expired
    const timeout = setTimeout(() => {
      setPageState((current) => {
        if (current === "verifying") return "invalid";
        return current;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    const { error: updateError } = await supabaseClient.auth.updateUser({
      password,
    });

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    setPageState("success");
    setTimeout(() => router.push("/account"), 1500);
  }

  if (pageState === "verifying") {
    return (
      <main className="site-shell">
        <section className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-14">
          <div className="soft-card w-full space-y-4 p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--rose-primary)] border-t-transparent" />
            <p className="font-semibold text-[var(--text-primary)]">
              Verifying your link&hellip;
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (pageState === "invalid") {
    return (
      <main className="site-shell">
        <section className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-14">
          <div className="soft-card w-full space-y-5 p-8">
            <div
              style={{
                background: "var(--rose-primary)",
                borderRadius: 16,
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                This link has expired or is invalid
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Password setup links expire after 24 hours. You can request a
                new one from the confirmation page, or contact support if you
                need help.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/login" className="primary-button text-center">
                Go to login
              </Link>
              <a
                href="mailto:support@wagzly.com"
                className="text-center text-sm font-semibold text-[var(--rose-primary)]"
              >
                Contact support
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (pageState === "success") {
    return (
      <main className="site-shell">
        <section className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-14">
          <div className="soft-card w-full space-y-4 p-8 text-center">
            <div
              style={{
                background: "#2f7d46",
                borderRadius: 16,
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              Password set! Taking you to your dashboard&hellip;
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-14">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
              Final step
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)]">
              Create your Wagzly password
            </h1>

            <p className="mt-5 text-lg leading-8 text-[var(--text-secondary)]">
              Your account and 14-day free trial are ready. Set your password to
              finish and access your dashboard.
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="soft-card space-y-4 p-7">
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                type="password"
                placeholder="Create a password (min. 8 characters)"
                className="mt-2 w-full"
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)]">
                Confirm password
              </label>
              <input
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                type="password"
                placeholder="Confirm your password"
                className="mt-2 w-full"
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="primary-button w-full"
            >
              {saving ? "Saving password..." : "Set password & open dashboard"}
            </button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              Already have a password?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--rose-primary)]"
              >
                Log in
              </Link>
            </p>
          </form>

        </div>
      </section>
    </main>
  );
}
