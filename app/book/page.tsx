"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

type GroomerResult = {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  bookingSlug: string;
};

export default function BookPage() {
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<GroomerResult[]>([]);
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

    const res = await fetch(`/api/book/search?zip=${zip.trim()}`);
    const data = await res.json();
    setLoading(false);
    setSearched(true);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setResults(data.results ?? []);
  }

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
          <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">
            Enter your zip code to see mobile groomers in your area powered by Wagzly.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-10 flex gap-3">
          <input
            value={zip}
            onChange={(e) => {
              setZip(e.target.value);
              setError("");
            }}
            placeholder="Enter zip code"
            maxLength={5}
            className="flex-1"
          />
          <button type="submit" disabled={loading} className="primary-button shrink-0">
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error ? (
          <p className="error-banner mt-4 px-4 py-3 text-sm font-semibold">{error}</p>
        ) : null}

        {searched && results.length === 0 && !error ? (
          <div className="mt-10 rounded-3xl bg-white/70 p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-[var(--text-primary)]">No groomers found</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              We couldn&apos;t find any Wagzly groomers serving that zip code right now. Check back soon!
            </p>
          </div>
        ) : null}

        {results.length > 0 ? (
          <div className="mt-10 space-y-4">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              {results.length} groomer{results.length !== 1 ? "s" : ""} found near {zip}
            </p>
            {results.map((g) => (
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
                <div className="flex-1">
                  <p className="font-bold text-[var(--text-primary)]">
                    {g.businessName ?? "Wagzly Groomer"}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--rose-primary)] font-semibold">
                    Book now →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
