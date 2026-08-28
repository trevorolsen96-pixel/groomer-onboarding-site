"use client";

import Link from "next/link";
import { useSession } from "../lib/use-session";

type HomeCtasProps = {
  demoBookingUrl: string;
  showDemoCard?: boolean;
};

export default function HomeCtas({
  demoBookingUrl,
  showDemoCard = true,
}: HomeCtasProps) {
  const { loading, loggedIn } = useSession();

  if (loading) {
    return (
      <div className="mt-8 h-12 w-64 rounded-2xl bg-[var(--soft-surface)]" />
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap gap-4">
        {loggedIn ? (
          <Link href="/account" className="primary-button">
            Go to my account
          </Link>
        ) : (
          <>
            <Link href="/create-account" className="primary-button">
              Start 14-day trial
            </Link>

            <Link href="/login" className="secondary-button">
              Log in
            </Link>
          </>
        )}
      </div>

      {!loggedIn ? (
        <ul className="trust-row">
          <li>14-day free trial</li>
          <li>No setup fees</li>
          <li>Cancel anytime</li>
        </ul>
      ) : null}

      {showDemoCard ? (
        <div className="max-w-xl rounded-3xl border border-[var(--divider-soft)] bg-white/75 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rose-primary)]">
            Want to see it first?
          </p>

          <h3 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
            Book a free 30-minute live demo
          </h3>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            See scheduling, client management, onboarding, and reminders in
            action, with someone who can answer your questions live.
          </p>

          <a
            href={demoBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-button mt-4 inline-flex"
          >
            Book a demo
          </a>
        </div>
      ) : null}
    </div>
  );
}