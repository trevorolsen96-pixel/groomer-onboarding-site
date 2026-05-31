import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import AccountMenu from "../components/AccountMenu";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wagzly.com"),
  title: "Wagzly",
  description:
    "Wagzly is mobile grooming software for groomers — and the easiest way for pet owners to find and book a local mobile groomer.",
  openGraph: {
    title: "Wagzly",
    description:
      "Wagzly is mobile grooming software for groomers — and the easiest way for pet owners to find and book a local mobile groomer.",
    url: "https://www.wagzly.com",
    siteName: "Wagzly",
    images: [
      {
        url: "/images/logo/WagzlyHLarge.png",
        width: 1200,
        height: 630,
        alt: "Wagzly",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wagzly",
    description:
      "Wagzly is mobile grooming software for groomers — and the easiest way for pet owners to find and book a local mobile groomer.",
    images: ["/images/logo/WagzlyHLarge.png"],
  },
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
                <Link href="/" className="nav-link hidden sm:inline-flex">
                  Home
                </Link>
                <Link href="/book" className="nav-link hidden sm:inline-flex">
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