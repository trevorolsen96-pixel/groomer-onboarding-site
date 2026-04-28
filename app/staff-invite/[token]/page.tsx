"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type StaffInviteResponse = {
  business_name: string;
  logo_url: string | null;
  staff_name: string;
  email: string;
  phone: string;
  status: string;
  error?: string;
};

export default function StaffInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function loadInvite() {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`/api/staff-invite/${token}`);
        const result: StaffInviteResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load staff invite.");
        }

        setBusinessName(result.business_name);
        setLogoUrl(result.logo_url);
        setStaffName(result.staff_name);
        setEmail(result.email ?? "");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load staff invite.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvite();
    }
  }, [token]);

  function validatePassword(value: string) {
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(value)) return "Password must include at least one letter.";
    if (!/[0-9]/.test(value)) return "Password must include at least one number.";
    return "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    const passwordError = validatePassword(password);

    if (passwordError) {
      setSubmitError(passwordError);
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/staff-invite/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create account.");
      }

      router.push("/thank-you");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create account.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <p className="text-[var(--text-secondary)]">
            Loading staff invite...
          </p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Unable to load invite
          </h1>
          <p className="mt-3 text-[var(--text-secondary)]">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="site-shell min-h-screen px-4 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-xl">
        <div className="soft-card mb-8 p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--divider-soft)]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--soft-surface)] text-2xl font-bold text-[var(--text-secondary)] ring-1 ring-[var(--divider-soft)]">
                {businessName ? businessName.charAt(0).toUpperCase() : "W"}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                Staff invite
              </p>
              <h1 className="text-3xl font-bold">{businessName}</h1>
              <p className="mt-2 text-[var(--text-secondary)]">
                Hi {staffName || "there"}, create your Wagzly staff account below.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="soft-card space-y-6 p-6">
          <section>
            <h2 className="text-xl font-semibold">Create your account</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Use this login when opening the Wagzly app.
            </p>

            <div className="mt-5 space-y-4">
              <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                placeholder="Password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <input
                placeholder="Confirm password"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <p className="text-xs text-[var(--text-secondary)]">
                Password must be at least 8 characters and include at least one
                letter and one number.
              </p>
            </div>
          </section>

          {submitError ? (
            <div className="error-banner px-4 py-3 text-sm">{submitError}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="primary-button w-full px-5 py-3"
          >
            {submitting ? "Creating account..." : "Create staff account"}
          </button>
        </form>
      </div>
    </main>
  );
}