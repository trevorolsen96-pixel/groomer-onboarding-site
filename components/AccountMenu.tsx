"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseClient } from "../lib/supabase-client";

type BusinessInfo = {
  name: string | null;
  logoUrl: string | null;
};

export default function AccountMenu() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabaseClient.auth.getSession();
      if (!mounted) return;

      const user = data.session?.user ?? null;
      setEmail(user?.email ?? null);

      if (user) {
        await loadBusiness(user.id);
      }

      setLoading(false);
    }

    loadSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (_event, session) => {
        setEmail(session?.user.email ?? null);
        if (session?.user) {
          await loadBusiness(session.user.id);
        } else {
          setBusiness(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadBusiness(userId: string) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("business_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.business_id) return;

    const { data: settings } = await supabaseClient
      .from("business_settings")
      .select("business_name, logo_url")
      .eq("business_id", profile.business_id)
      .maybeSingle();

    setBusiness({
      name: settings?.business_name ?? null,
      logoUrl: settings?.logo_url ?? null,
    });
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    setSigningOut(true);
    setOpen(false);
    await supabaseClient.auth.signOut();
    setEmail(null);
    setBusiness(null);
    setSigningOut(false);
    window.location.href = "/";
  }

  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-[var(--soft-surface)] animate-pulse" />;
  }

  // Logged out
  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl border border-[var(--divider-soft)] bg-white px-4 py-2 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--soft-surface)]"
      >
        Log in
      </Link>
    );
  }

  // Logged in
  const displayName = business?.name ?? email;
  const initials = (business?.name ?? email)
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl border border-[var(--divider-soft)] bg-white px-3 py-1.5 shadow-sm hover:bg-[var(--soft-surface)] transition"
      >
        {/* Logo / avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--soft-surface)]">
          {business?.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt={business.name ?? "Business"}
              width={32}
              height={32}
              className="h-8 w-8 object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-[var(--rose-primary-dark)]">
              {initials || "?"}
            </span>
          )}
        </div>

        {/* Name */}
        <span className="hidden max-w-[160px] truncate text-sm font-semibold text-[var(--text-primary)] sm:block">
          {displayName}
        </span>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--divider-soft)] bg-white shadow-lg">
          <div className="border-b border-[var(--divider-soft)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--text-primary)]">{email}</p>
          </div>

          <div className="p-1.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--soft-surface)]"
            >
              <svg className="h-4 w-4 text-[var(--rose-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              My Account
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              {signingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
