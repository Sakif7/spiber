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
};

export default withNextIntl(nextConfig);
