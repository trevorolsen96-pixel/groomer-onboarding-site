import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import SiteShell from "../components/SiteShell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wagzly.com"),
  title: {
    default: "Wagzly | Mobile Grooming Software for Groomers",
    template: "%s | Wagzly",
  },
  description:
    "Wagzly is all-in-one mobile grooming software: scheduling, client management, online payments, automated reminders, and more. The easiest way to run your mobile grooming business.",
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
      "Wagzly is all-in-one mobile grooming software: scheduling, client management, online payments, automated reminders, and more.",
    url: "https://www.wagzly.com",
    siteName: "Wagzly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wagzly | Mobile Grooming Software for Groomers",
    description:
      "Wagzly is all-in-one mobile grooming software: scheduling, client management, online payments, automated reminders, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
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
                "Wagzly is all-in-one mobile grooming software: scheduling, client management, online payments, automated reminders, and more.",
              applicationCategory: "BusinessApplication",
              sameAs: [],
            }),
          }}
        />
      </head>
      <body>
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1541171171374834');
          fbq('track', 'PageView');`}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1541171171374834&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}