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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo/WagzlyCompact1.png"
              alt="Wagzly"
              width={60}
              height={60}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terms" className="footer-link">Terms of Service</Link>
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
