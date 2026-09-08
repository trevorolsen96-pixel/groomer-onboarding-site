"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  cardLinkId: string;
  businessName: string;
  logoUrl: string | null;
  customerName: string;
  existingCard: { brand: string; last4: string } | null;
};

function titleCase(value: string) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function AddCardPage({
  cardLinkId,
  businessName,
  logoUrl,
  customerName,
  existingCard,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSaveCard() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/add-card/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_link_id: cardLinkId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to start card setup.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--soft-surface)] px-4 py-12">
      <div className="w-full max-w-md space-y-5">

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

        <div className="soft-card p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Card on file request
          </p>
          <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{businessName}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{customerName}</p>
        </div>

        <div className="soft-card p-6 space-y-4">
          {existingCard && (
            <div className="rounded-2xl border border-[var(--divider-soft)] bg-white px-4 py-3 text-sm text-[var(--text-secondary)]">
              You already have a card on file: {titleCase(existingCard.brand)} ending in {existingCard.last4}.
              Saving a new card below will replace it.
            </div>
          )}

          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {businessName} is asking you to save a card on file. It will only be
            charged for fees you&apos;ve agreed to — such as a late-cancellation
            or no-show fee — never without you being told first.
          </p>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveCard}
            disabled={loading}
            className="primary-button w-full justify-center"
          >
            {loading ? "Redirecting to Stripe..." : "Save a Card"}
          </button>

          <p className="text-center text-xs text-[var(--text-secondary)]">
            Your card is saved securely by Stripe. Wagzly does not store your card details.
          </p>
        </div>

      </div>
    </main>
  );
}
