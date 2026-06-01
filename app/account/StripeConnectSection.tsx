"use client";

import { useState } from "react";

type PaymentStatus = {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  payments_enabled: boolean;
  status: string;
};

type Props = {
  accessToken: string;
  isPro: boolean;
  initialStatus: PaymentStatus | null;
  justConnected?: boolean;
};

export default function StripeConnectSection({
  accessToken,
  isPro,
  initialStatus,
  justConnected = false,
}: Props) {
  const [status, setStatus] = useState<PaymentStatus | null>(initialStatus);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    justConnected ? "Stripe account connected! Your payment status has been refreshed." : ""
  );

  async function handleConnect() {
    setConnecting(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/stripe-connect/connect", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Unable to start Stripe setup.");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Stripe setup.");
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/stripe-connect/refresh", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Unable to refresh status.");
      }

      setStatus(data);
      setSuccessMessage("Payment status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh status.");
    } finally {
      setRefreshing(false);
    }
  }

  const isActive = status?.payments_enabled === true;
  const isConnected = status?.connected === true;
  const needsAction = isConnected && !isActive;

  const primaryLabel = !isConnected
    ? "Connect Stripe"
    : needsAction
    ? "Finish Stripe Setup"
    : "Manage Stripe Account";

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="soft-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-[var(--rose-primary)]">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Wagzly Payments</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Connect your Stripe account to send secure online payment links to your clients.
              Payments go directly to your Stripe account — Wagzly never handles your money.
            </p>
          </div>
        </div>
      </section>

      {/* Messages */}
      {successMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-green-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {/* Pro gate */}
      {!isPro ? (
        <section className="soft-card p-6">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rose-primary)]">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div>
              <p className="font-bold text-[var(--text-primary)]">Pro feature</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Online payments are included with Wagzly Pro. Upgrade your plan to connect Stripe and start accepting payments.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Status checklist */}
          <section className="soft-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--rose-primary)]">
              Connection status
            </p>

            <div className="mt-4 space-y-3">
              <CheckRow label="Stripe account connected" checked={isConnected} />
              <CheckRow label="Business details submitted" checked={status?.details_submitted === true} />
              <CheckRow label="Charges enabled" checked={status?.charges_enabled === true} />
              <CheckRow label="Payouts enabled" checked={status?.payouts_enabled === true} />
            </div>

            {isActive ? (
              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <p className="text-sm font-bold text-green-700">Payments are active</p>
              </div>
            ) : needsAction ? (
              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <p className="text-sm font-bold text-amber-700">
                  Stripe setup is incomplete — click &quot;Finish Stripe Setup&quot; to continue
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[var(--soft-surface)] px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  Not connected — click &quot;Connect Stripe&quot; to get started
                </p>
              </div>
            )}
          </section>

          {/* Actions */}
          <section className="soft-card p-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || refreshing}
                className="primary-button"
              >
                {connecting ? "Opening Stripe..." : primaryLabel}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={connecting || refreshing}
                className="secondary-button"
              >
                {refreshing ? "Refreshing..." : "Refresh Status"}
              </button>
            </div>

            <p className="mt-4 text-xs text-[var(--text-secondary)]">
              Clicking &quot;Connect Stripe&quot; will open Stripe&apos;s secure onboarding page.
              After completing setup, you&apos;ll be returned here automatically.
              Use &quot;Refresh Status&quot; to sync the latest info from Stripe.
            </p>
          </section>

          {/* How it works */}
          <section className="soft-card p-6">
            <p className="text-sm font-bold text-[var(--text-primary)]">How payments work</p>
            <div className="mt-3 space-y-2">
              <HowItWorksRow icon="1" text="You send a payment link from the Wagzly app after an appointment." />
              <HowItWorksRow icon="2" text="Your client receives an SMS with a link to your secure payment page." />
              <HowItWorksRow icon="3" text="They choose a tip and pay — the money goes directly to your Stripe account." />
              <HowItWorksRow icon="4" text="Wagzly never holds your money. Standard Stripe fees apply to your account." />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {checked ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 shrink-0 text-green-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-[var(--text-secondary)]/40">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
      <span className={`text-sm font-semibold ${checked ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
        {label}
      </span>
    </div>
  );
}

function HowItWorksRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">
        {icon}
      </span>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{text}</p>
    </div>
  );
}
