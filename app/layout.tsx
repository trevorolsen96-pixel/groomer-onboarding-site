import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import AccountMenu from "../components/AccountMenu";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wagzly.com"),
  title: {
    default: "Wagzly | Mobile Grooming Software for Groomers",
    template: "%s | Wagzly",
  },
  description:
    "Wagzly is all-in-one mobile grooming software — scheduling, client management, online payments, automated reminders, and more. The easiest way to run your mobile grooming business.",
  keywords: [
    "mobile grooming software",
    "grooming business software",
    "pet grooming scheduling",
    "grooming app",
    "MoeGo alternative",
    "grooming CRM",
    "mobile pet groomer app",
    "grooming appointment software",
  ],
  openGraph: {
    title: "Wagzly | Mobile Grooming Software for Groomers",
    description:
      "Wagzly is all-in-one mobile grooming software — scheduling, client management, online payments, automated reminders, and more.",
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
    title: "Wagzly | Mobile Grooming Software for Groomers",
    description:
      "Wagzly is all-in-one mobile grooming software — scheduling, client management, online payments, automated reminders, and more.",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Wagzly",
              url: "https://www.wagzly.com",
              logo: "https://www.wagzly.com/images/logo/WagzlyHLarge.png",
              description:
                "Wagzly is all-in-one mobile grooming software — scheduling, client management, online payments, automated reminders, and more.",
              applicationCategory: "BusinessApplication",
              sameAs: [],
            }),
          }}
        />
      </head>
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-[var(--divider-soft)] bg-[rgba(251,247,248,0.82)] backdrop-blur">
            <div className="mx-auto flex h-[64px] w-full max-w-6xl items-center justify-between px-4 md:h-[82px] md:px-6">
              {/* Mobile: small icon — Desktop: full logo */}
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
                {/* Desktop links */}
                <div className="hidden md:flex items-center gap-1">
                  <Link href="/features" className="nav-link">Features</Link>
                  <Link href="/pricing" className="nav-link">Pricing</Link>
                  <Link href="/#download" className="nav-link">Download</Link>
                  <Link href="/book" className="nav-link">Book Online</Link>
                </div>

                {/* Mobile: Book Online button */}
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