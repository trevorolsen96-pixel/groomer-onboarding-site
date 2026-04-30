"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseClient } from "../lib/supabase-client";

export default function AccountMenu() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabaseClient.auth.getSession();

      if (!mounted) return;

      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setSigningOut(true);
    await supabaseClient.auth.signOut();
    setEmail(null);
    setSigningOut(false);
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="h-10 w-28 rounded-full bg-[var(--soft-surface)]" />
    );
  }

  if (!email) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="secondary-button">
          Log in
        </Link>

        <Link href="/create-account" className="primary-button hidden sm:inline-flex">
          Start trial
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="hidden max-w-[220px] truncate rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] shadow-sm sm:block">
        {email}
      </div>

      <Link href="/account" className="primary-button">
        My account
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="secondary-button"
      >
        {signingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}