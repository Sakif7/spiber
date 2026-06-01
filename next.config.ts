import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Lean, self-contained build for Coolify / Docker.
  output: "standalone",
  // Mongoose must run in the Node.js runtime, not be bundled by Turbopack/webpack.
  serverExternalPackages: ["mongoose"],
  images: {
    // Cloudflare R2 / Stream thumbnail hosts are added here as phases land.
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
