"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseClient } from "../lib/supabase-client";

type HomeCtasProps = {
  demoBookingUrl: string;
};

export default function HomeCtas({ demoBookingUrl }: HomeCtasProps) {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabaseClient.auth.getSession();

      if (!mounted) return;

      setLoggedIn(Boolean(data.session?.user));
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

      <div className="max-w-xl rounded-3xl border border-[var(--divider-soft)] bg-white/75 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rose-primary)]">
          Want to see it first?
        </p>

        <h3 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
          Book a free 30-minute live demo
        </h3>

        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Book a free 30-minute live demo to explore scheduling, client management, onboarding, reminders, and see how Wagzly can help grow your grooming business.
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
    </div>
  );
}