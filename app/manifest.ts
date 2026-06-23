import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

/** PWA web manifest (served at /manifest.webmanifest, auto-linked by Next). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.brand} — Complete Healthcare Solutions`,
    short_name: siteConfig.brand,
    description:
      "Medical & surgical equipment, digital health software, training, and medical tourism — trusted across Bangladesh.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d8f91",
    icons: [
      {
        src: "/spibermed-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.jpeg",
        sizes: "192x192",
        type: "image/jpeg",
      },
    ],
  };
}
