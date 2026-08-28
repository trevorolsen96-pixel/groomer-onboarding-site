"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import AccountMenu from "./AccountMenu";
import { useSession } from "../lib/use-session";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#download", label: "Download" },
  { href: "/book", label: "Book Online" },
];

// Pages a client reaches via a link Wagzly (or the groomer, on Wagzly's
// behalf) sends or shares directly -- the marketing site's header/nav/
// footer (Features, Pricing, Download, Book Online, account menu) has
// nothing to do with why a client is there, and just gives them a way to
// wander off into the marketing site instead of finishing what they
// opened the link for. Only groomers need to know about the website
// itself; their clients just need the one page they were sent.
//
// `/book/` (with a slug) is a specific business's own booking page,
// shared by that groomer with their clients -- unlike the bare `/book`
// search page (find-a-groomer), which is a real marketing page and keeps
// the header.
const CLIENT_FACING_PREFIXES = [
  "/onboarding",
  "/report",
  "/book/",
  "/pay",
  "/thank-you",
];

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isClientFacing = CLIENT_FACING_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showMobileCta, setShowMobileCta] = useState(false);
  const { loading: sessionLoading, loggedIn } = useSession();

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      setScrolled(y > 8);

      const nearBottom =
        y + window.innerHeight > document.documentElement.scrollHeight - 240;
      setShowMobileCta(y > 480 && !nearBottom);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isAdmin || isClientFacing) {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href.startsWith("/#")) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen">
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur transition-shadow duration-300 ${
          scrolled
            ? "border-[var(--divider-soft)] bg-[rgba(251,247,248,0.92)] shadow-[0_8px_24px_rgba(46,36,48,0.06)]"
            : "border-transparent bg-[rgba(251,247,248,0.7)]"
        }`}
      >
        <div className="mx-auto flex h-[64px] w-full max-w-6xl items-center justify-between px-4 md:h-[82px] md:px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo/WagzlyApp.png"
              alt="Wagzly"
              width={36}
              height={36}
              priority
              className="block md:hidden"
            />
            <Image
              src="/images/logo/WagzlyHLarge.png"
              alt="Wagzly"
              width={200}
              height={54}
              priority
              className="hidden md:block"
            />
          </Link>

          <nav className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive(link.href) ? "nav-link-active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--divider-soft)] bg-white text-[var(--text-primary)] md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>

            <AccountMenu />
          </nav>
        </div>

        <div
          className={`mobile-menu ${menuOpen ? "is-open" : ""}`}
          inert={!menuOpen}
        >
          <div>
            <nav className="flex flex-col gap-1 px-4 pb-4 pt-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`nav-link !justify-start ${isActive(link.href) ? "nav-link-active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
              {!sessionLoading && !loggedIn ? (
                <Link
                  href="/create-account"
                  onClick={() => setMenuOpen(false)}
                  className="primary-button mt-2 justify-center"
                >
                  Start 14-day trial
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>

      {children}

      {!sessionLoading ? (
        <div
          className={`mobile-cta-bar ${showMobileCta ? "is-shown" : ""}`}
          inert={!showMobileCta}
        >
          {loggedIn ? (
            <Link href="/account" className="primary-button flex-1 justify-center">
              Go to my account
            </Link>
          ) : (
            <>
              <Link href="/create-account" className="primary-button flex-1 justify-center">
                Start 14-day trial
              </Link>
              <Link href="/login" className="secondary-button justify-center">
                Log in
              </Link>
            </>
          )}
        </div>
      ) : null}

      <footer className="border-t border-[var(--divider-soft)] bg-[rgba(255,255,255,0.72)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 sm:grid-cols-3">
          <div>
            <Image
              src="/images/logo/WagzlyCompact1.png"
              alt="Wagzly"
              width={56}
              height={56}
            />
            <p className="mt-3 max-w-[240px] text-sm text-[var(--text-secondary)]">
              Scheduling, clients, and payments, built for mobile groomers.
            </p>
            <p className="mt-4 text-xs text-[var(--text-secondary)]">
              &copy; {new Date().getFullYear()} Wagzly. All rights reserved.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Product
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/features" className="footer-link">Features</Link>
              <Link href="/pricing" className="footer-link">Pricing</Link>
              <Link href="/book" className="footer-link">Book Online</Link>
              <Link href="/create-account" className="footer-link">Create Account</Link>
            </nav>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Support
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              <a href="mailto:support@wagzly.com" className="footer-link">
                support@wagzly.com
              </a>
              <Link href="/privacy" className="footer-link">Privacy Policy</Link>
              <Link href="/terms" className="footer-link">Terms of Service</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
