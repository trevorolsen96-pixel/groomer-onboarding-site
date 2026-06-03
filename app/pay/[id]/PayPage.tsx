"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  paymentLinkId: string;
  businessName: string;
  logoUrl: string | null;
  customerName: string;
  serviceName: string;
  amountDue: number;
};

const TIP_PRESETS = [
  { label: "No tip", value: 0 },
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.20 },
  { label: "25%", pct: 0.25 },
];

function fmt(amount: number) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function PayPage({ paymentLinkId, businessName, logoUrl, customerName, serviceName, amountDue }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(0.15);
  const [customTip, setCustomTip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tipAmount = (() => {
    if (selectedPreset === "custom") {
      const v = parseFloat(customTip);
      return isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100;
    }
    if (selectedPreset === 0) return 0;
    return Math.round(amountDue * (selectedPreset as number) * 100) / 100;
  })();

  const total = Math.round((amountDue + tipAmount) * 100) / 100;

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pay/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_link_id: paymentLinkId, tip_amount: tipAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to start payment.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
      <div className="w-full max-w-md space-y-5">

        {/* Header — business logo or initials avatar */}
        <div className="text-center">
          <Image
            src={logoUrl ?? "/images/logo/WagzlyHLarge.png"}
            alt={logoUrl ? businessName : "Wagzly"}
            width={logoUrl ? 80 : 160}
            height={logoUrl ? 80 : 44}
            className={logoUrl ? "mx-auto h-20 w-20 rounded-full object-cover shadow-md" : "mx-auto"}
            unoptimized={!!logoUrl}
          />
        </div>

        {/* Business & appointment card */}
        <div className="soft-card p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Payment request
          </p>
          <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{businessName}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{customerName}</p>
          <p className="mt-4 text-4xl font-bold text-[var(--text-primary)]">{fmt(amountDue)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Balance due</p>
        </div>

        {/* Tip selection */}
        <div className="soft-card p-6 space-y-4">
          <p className="text-sm font-bold text-[var(--text-primary)]">Add a tip for your groomer</p>

          <div className="grid grid-cols-4 gap-2">
            {TIP_PRESETS.map((preset) => {
              const presetKey = preset.value !== undefined ? preset.value : preset.pct!;
              const isSelected = selectedPreset === presetKey;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setSelectedPreset(presetKey); setCustomTip(""); }}
                  className={`rounded-2xl border-2 px-2 py-3 text-sm font-bold transition-colors ${
                    isSelected
                      ? "border-[var(--rose-primary)] bg-[var(--rose-primary)]/10 text-[var(--rose-primary)]"
                      : "border-[var(--divider-soft)] bg-white text-[var(--text-secondary)] hover:border-[var(--rose-primary)]"
                  }`}
                >
                  {preset.label}
                  {preset.pct && (
                    <span className="block text-xs font-normal opacity-70">
                      {fmt(Math.round(amountDue * preset.pct * 100) / 100)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom tip */}
          <button
            type="button"
            onClick={() => setSelectedPreset("custom")}
            className={`w-full rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-colors text-left ${
              selectedPreset === "custom"
                ? "border-[var(--rose-primary)] bg-[var(--rose-primary)]/10"
                : "border-[var(--divider-soft)] bg-white text-[var(--text-secondary)] hover:border-[var(--rose-primary)]"
            }`}
          >
            Custom amount
          </button>

          {selectedPreset === "custom" && (
            <div className="flex items-center rounded-2xl border-2 border-[var(--rose-primary)] bg-white px-4 py-3 gap-1">
              <span className="font-bold text-[var(--text-secondary)] select-none">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={customTip}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setCustomTip(val);
                }}
                className="flex-1 bg-transparent text-sm font-bold text-[var(--text-primary)] outline-none"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Total & pay button */}
        <div className="soft-card p-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Grooming service</span>
              <span className="font-semibold">{fmt(amountDue)}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Tip</span>
                <span className="font-semibold">{fmt(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--divider-soft)] pt-2 font-bold text-[var(--text-primary)]">
              <span>Total</span>
              <span className="text-lg">{fmt(total)}</span>
            </div>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={loading}
            className="primary-button w-full justify-center"
          >
            {loading ? "Redirecting to payment..." : `Pay ${fmt(total)}`}
          </button>

          <p className="text-center text-xs text-[var(--text-secondary)]">
            Payments are processed securely by Stripe. Wagzly does not store your card details.
          </p>
        </div>

      </div>
    </main>
  );
}
