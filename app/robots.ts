import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url;
  // Block private/transactional areas. With `localePrefix: "as-needed"` the
  // default locale is un-prefixed (/admin), while bn/ja keep their prefix
  // (/bn/admin). Faceted/search/pagination URLs stay crawlable but carry meta
  // `noindex`, so link equity still flows while index bloat is avoided.
  const privatePaths = ["/admin", "/account", "/reset-password"];
  const disallow = [
    "/api/",
    ...privatePaths,
    ...["bn", "ja"].flatMap((l) => privatePaths.map((p) => `/${l}${p}`)),
  ];
  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${base}/sitemap.xml`,
  };
}
