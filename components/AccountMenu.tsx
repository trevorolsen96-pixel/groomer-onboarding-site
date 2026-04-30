"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-[var(--divider-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm"
      >
        Account
        <span className="text-xs text-[var(--text-secondary)]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-[var(--divider-soft)] bg-white p-3 shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rose-primary)]">
            Wagzly Account
          </p>

          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--soft-surface)]"
          >
            Log in
          </Link>

          <Link
            href="/create-account"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--soft-surface)]"
          >
            Create account
          </Link>

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--soft-surface)]"
          >
            Account & billing
          </Link>
        </div>
      )}
    </div>
  );
}