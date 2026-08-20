"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AccountMenu from "./AccountMenu";

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

  if (isAdmin || isClientFacing) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--divider-soft)] bg-[rgba(251,247,248,0.82)] backdrop-blur">
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
              <Link href="/features" className="nav-link">Features</Link>
              <Link href="/pricing" className="nav-link">Pricing</Link>
              <Link href="/#download" className="nav-link">Download</Link>
              <Link href="/book" className="nav-link">Book Online</Link>
            </div>
            <Link
              href="/book"
              className="flex items-center gap-1.5 rounded-xl bg-[var(--rose-primary)] px-3 py-2 text-sm font-bold text-white md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              Book Online
            </Link>
            <AccountMenu />
          </nav>
        </div>
      </header>

      {children}

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
              Scheduling, clients, and payments — built for mobile groomers.
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
