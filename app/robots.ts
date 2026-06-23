import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url;
  // Block private/transactional areas across every locale prefix. Faceted,
  // search, and pagination URLs stay crawlable but carry meta `noindex`, so
  // link equity still flows while index bloat is avoided.
  const disallow = [
    "/api/",
    ...["en", "bn", "ja"].flatMap((l) => [
      `/${l}/admin`,
      `/${l}/account`,
      `/${l}/reset-password`,
    ]),
  ];
  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${base}/sitemap.xml`,
  };
}
