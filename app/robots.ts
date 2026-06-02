import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account/", "/pay/", "/onboarding/", "/staff-invite/"],
    },
    sitemap: "https://www.wagzly.com/sitemap.xml",
  };
}
