import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wagzly",
  description:
    "Wagzly provides beautiful client onboarding for mobile grooming businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-[var(--divider-soft)] bg-[rgba(251,247,248,0.82)] backdrop-blur">
            <div className="mx-auto flex h-[82px] w-full max-w-6xl items-center justify-between px-6">
              <Link href="/" className="flex items-center">
                <Image
                  src="/images/logo/WagzlyHLarge.png"
                  alt="Wagzly"
                  width={220}
                  height={60}
                  priority
                />
              </Link>

              <nav className="flex items-center gap-2 sm:gap-3">
                <Link href="/" className="nav-link">
                  Home
                </Link>
                <Link href="/terms" className="nav-link">
                  Terms
                </Link>
                <Link href="/privacy" className="nav-link">
                  Privacy
                </Link>
              </nav>
            </div>
          </header>

          {children}

          <footer className="border-t border-[var(--divider-soft)] bg-[rgba(255,255,255,0.72)]">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo/WagzlyCompact.png"
                  alt="Wagzly"
                  width={120}
                  height={60}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/terms" className="footer-link">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="footer-link">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}