import type { Metadata } from "next";
import SiteShell from "../components/SiteShell";
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
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}