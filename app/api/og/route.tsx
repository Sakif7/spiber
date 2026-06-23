import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

// Branded default Open Graph card (1200×630). Served at /api/og; the build also
// snapshots it to /public/og.png (via scripts/gen-og.mjs) which is the URL
// referenced in metadata, so the social image is a stable, crawlable static
// asset. Keep this route as the source of truth for the design.
export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "84px",
        background: "linear-gradient(135deg, #07333b 0%, #0d8f91 100%)",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          opacity: 0.92,
        }}
      >
        {siteConfig.brand}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          Complete Healthcare
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#9ff0f1",
          }}
        >
          Solutions
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            marginTop: 24,
            opacity: 0.85,
          }}
        >
          Medical devices · Digital health · Training · Tourism
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 30, opacity: 0.8 }}>
        {siteConfig.domain}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
