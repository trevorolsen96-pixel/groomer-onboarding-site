"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

type GroomerResult = {
  businessId: string;
  businessName: string | null;
  logoUrl: string | null;
  bookingSlug: string;
  address: string | null;
  distanceMiles: number;
};

const VISIBLE_DEFAULT = 10;

function SearchTab({ type }: { type: "mobile" | "salon" }) {
  const isSalon = type === "salon";
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<GroomerResult[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) {
      setError("Please enter a valid 5-digit zip code.");
      return;
    }
    setLoading(true);
    setError("");
    setSearched(false);
    setShowAll(false);

    const res = await fetch(`/api/book/search?zip=${zip.trim()}&type=${type}`);
    const data = await res.json();
    setLoading(false);
    setSearched(true);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setResults(data.results ?? []);
  }

  const visible = showAll ? results : results.slice(0, VISIBLE_DEFAULT);
  const hasMore = results.length > VISIBLE_DEFAULT && !showAll;

  return (
    <div>
      <p className="mt-2 text-lg leading-8 text-[var(--text-secondary)] text-center">
        {isSalon
          ? "Enter your zip code to find salons near you."
          : "Enter your zip code to see mobile groomers that come to you."}
      </p>

      <form onSubmit={handleSearch} className="mt-10 flex gap-3">
        <input
          value={zip}
          onChange={(e) => { setZip(e.target.value); setError(""); }}
          placeholder="Enter zip code"
          maxLength={5}
          className="flex-1"
        />
        <button type="submit" disabled={loading} className="primary-button shrink-0">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? (
        <p className="error-banner mt-4 px-4 py-3 text-sm font-semibold">{error}</p>
      ) : null}

      {searched && results.length === 0 && !error ? (
        <div className="mt-10 rounded-3xl bg-white/70 p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-[var(--text-primary)]">No groomers found</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {isSalon
              ? "We couldn't find any Wagzly salons within 60 miles of that zip code. Check back soon!"
              : "We couldn't find any Wagzly mobile groomers serving that zip code right now. Check back soon!"}
          </p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-10 space-y-4">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {results.length} {isSalon ? "salon" : "groomer"}{results.length !== 1 ? "s" : ""} found near {zip}
          </p>

          {visible.map((g) => (
            <Link
              key={g.businessId}
              href={`/book/${g.bookingSlug}`}
              className="soft-card flex items-center gap-5 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--soft-surface)]">
                {g.logoUrl ? (
                  <Image
                    src={g.logoUrl}
                    alt={g.businessName ?? "Groomer"}
                    width={56}
                    height={56}
                    className="h-14 w-14 object-cover"
                  />
                ) : (
                  <span className="text-2xl">🐾</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text-primary)] truncate">
                  {g.businessName ?? "Wagzly Groomer"}
                </p>
                {isSalon && g.address ? (
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)] truncate">{g.address}</p>
                ) : null}
                <p className="mt-0.5 text-sm text-[var(--rose-primary)] font-semibold">
                  {g.distanceMiles} mi away · Book now →
                </p>
              </div>
            </Link>
          ))}

          {hasMore ? (
            <button
              onClick={() => setShowAll(true)}
              className="w-full rounded-2xl border border-[var(--divider-soft)] bg-white/60 py-4 text-sm font-semibold text-[var(--rose-primary)] hover:bg-white transition-colors"
            >
              Show {results.length - VISIBLE_DEFAULT} more {isSalon ? "salon" : "groomer"}{results.length - VISIBLE_DEFAULT !== 1 ? "s" : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function BookPage() {
  const [tab, setTab] = useState<"mobile" | "salon">("mobile");

  return (
    <main className="site-shell">
      <section className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
            Online Booking
          </p>
          <h1 className="mt-4 text-4xl font-bold text-[var(--text-primary)]">
            Find a Wagzly groomer near you
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="mt-10 flex rounded-2xl bg-[var(--soft-surface)] p-1.5 gap-1">
          <button
            onClick={() => setTab("mobile")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === "mobile"
                ? "bg-white shadow-sm text-[var(--rose-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            🚐 Mobile Grooming
          </button>
          <button
            onClick={() => setTab("salon")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === "salon"
                ? "bg-white shadow-sm text-[var(--rose-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            🏪 Salon
          </button>
        </div>

        {tab === "mobile" ? <SearchTab type="mobile" /> : <SearchTab type="salon" />}
      </section>
    </main>
  );
}
