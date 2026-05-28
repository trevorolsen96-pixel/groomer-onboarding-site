"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function FinishCreateAccountPage() {
  return (
    <Suspense fallback={<FinishLoading />}>
      <FinishContent />
    </Suspense>
  );
}

function FinishLoading() {
  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-14">
        <div className="soft-card w-full p-8">
          <p className="font-bold text-[var(--text-primary)]">
            Loading...
          </p>
        </div>
      </section>
    </main>
  );
}

function FinishContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [statusReady, setStatusReady] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Fetch the email address for this session so we can show it
  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(
          `/api/signup-status?session_id=${encodeURIComponent(sessionId)}`,
          { signal: controller.signal }
        );

        if (response.ok) {
          const data = await response.json();
          setEmail(data.email ?? null);
          setFirstName(data.firstName ?? "there");
          setStatusReady(true);
        } else {
          setStatusReady(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatusReady(true);
        }
      }
    })();

    return () => controller.abort();
  }, [sessionId]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function handleResend() {
    if (resending || resendCooldown > 0 || !sessionId) return;

    setResending(true);
    setResendMessage("");

    try {
      const response = await fetch("/api/resend-setup-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendMessage("Email sent! Check your inbox.");
        setResendCooldown(60);
      } else {
        setResendMessage(result.error ?? "Unable to resend. Please try again.");
      }
    } catch {
      setResendMessage("Unable to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="site-shell">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-14">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">

          {/* Left column */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
              Almost there
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--text-primary)]">
              Check your email,{" "}
              {statusReady ? firstName : (
                <span className="inline-block h-8 w-24 animate-pulse rounded-lg bg-[var(--soft-surface)]" />
              )}
            </h1>

            <p className="mt-5 text-lg leading-8 text-[var(--text-secondary)]">
              Your payment went through and your 14-day free trial has started.
              We sent a link to set your password — click it to finish and access
              your dashboard.
            </p>

            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              Already set your password?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--rose-primary)]"
              >
                Log in
              </Link>
            </p>
          </div>

          {/* Right column — card */}
          <div className="soft-card space-y-5 p-7">

            {/* Envelope icon */}
            <div className="flex justify-center">
              <div
                style={{
                  background: "var(--rose-primary)",
                  borderRadius: "20px",
                  width: 72,
                  height: 72,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <p className="text-base font-bold text-[var(--text-primary)]">
                Password setup email sent
              </p>

              {statusReady && email ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  We sent instructions to{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {email}
                  </span>
                </p>
              ) : statusReady ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Check the inbox for the email address you signed up with.
                </p>
              ) : (
                <div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-[var(--soft-surface)]" />
              )}
            </div>

            <div
              style={{
                background: "var(--soft-surface)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  Don&apos;t see the email?
                </strong>{" "}
                Check your spam or junk folder. The link expires in 24 hours.
              </p>
            </div>

            {/* Resend button */}
            {resendMessage ? (
              <p
                className="text-center text-sm font-semibold"
                style={{
                  color: resendMessage.startsWith("Email sent")
                    ? "#2f7d46"
                    : "var(--rose-primary-dark)",
                }}
              >
                {resendMessage}
              </p>
            ) : null}

            <button
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="w-full rounded-2xl border border-[var(--rose-primary)] py-3 text-sm font-semibold text-[var(--rose-primary)] transition-opacity disabled:opacity-50"
              style={{ background: "transparent" }}
            >
              {resending
                ? "Sending..."
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend setup email"}
            </button>

            <p className="text-center text-xs text-[var(--text-secondary)]">
              Need help?{" "}
              <a
                href="mailto:support@wagzly.com"
                className="font-semibold text-[var(--rose-primary)]"
              >
                support@wagzly.com
              </a>
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}
