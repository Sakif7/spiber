import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Allow next/image to load from the R2 public base URL when configured.
const r2Patterns = (() => {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return [];
  try {
    const { protocol, hostname } = new URL(base);
    return [
      { protocol: protocol.replace(":", "") as "http" | "https", hostname },
    ];
  } catch {
    return [];
  }
})();

// Baseline security headers applied to every response. (A strict Content-
// Security-Policy is intentionally deferred — the marketing pages rely on inline
// styles; adding CSP needs a nonce pass to avoid breaking them.) X-Frame-Options
// is SAMEORIGIN (not DENY) because the lesson player frames same-origin PDFs.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Lean, self-contained build for Coolify / Docker.
  output: "standalone",
  // Dev only: allow the Next dev server's /_next/* assets + HMR to be served
  // when the app is reached through a tunnel (e.g. ngrok) instead of localhost.
  // Without this, Next 16 returns 403 for cross-origin dev requests → the page
  // loads unstyled with no JS. Harmless in production builds.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  // Must run in the Node.js runtime, not be bundled by Turbopack/webpack.
  serverExternalPackages: ["mongoose", "nodemailer"],
  images: {
    remotePatterns: r2Patterns,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Rebrand 2026: Spiber Instruments → Spiber Medtrade (/instruments → /medtrade),
  // Spiber Systems → Spiber Digihealth (/systems → /digihealth). Permanent (308)
  // redirects preserve every old deep link, both locale-prefixed (/en, /bn) and
  // bare. `:path*` covers the hub itself and all sub-routes. API paths
  // (/api/...) never match these sources, so internal endpoints are untouched.
  async redirects() {
    return [
      {
        source: "/:locale(en|bn|ja)/instruments/:path*",
        destination: "/:locale/medtrade/:path*",
        permanent: true,
      },
      {
        source: "/:locale(en|bn|ja)/systems/:path*",
        destination: "/:locale/digihealth/:path*",
        permanent: true,
      },
      {
        source: "/instruments/:path*",
        destination: "/medtrade/:path*",
        permanent: true,
      },
      {
        source: "/systems/:path*",
        destination: "/digihealth/:path*",
        permanent: true,
      },
      // Company section 2026: /about moved under the Company group.
      {
        source: "/:locale(en|bn|ja)/about",
        destination: "/:locale/company/about",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/company/about",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
