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

const nextConfig: NextConfig = {
  // Lean, self-contained build for Coolify / Docker.
  output: "standalone",
  // Must run in the Node.js runtime, not be bundled by Turbopack/webpack.
  serverExternalPackages: ["mongoose", "nodemailer"],
  images: {
    remotePatterns: r2Patterns,
  },
};

export default withNextIntl(nextConfig);
