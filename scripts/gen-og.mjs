// Snapshot the branded default Open Graph card to public/og.png.
//
// The card design lives in app/api/og/route.tsx (rendered with next/og). That
// module can't be imported by a bare Node script, so we render it through a
// running dev/prod server and save the bytes as a static, crawlable asset that
// metadata references (lib/seo/metadata.ts DEFAULT_OG_IMAGE → /og.png).
//
// Usage: start the app (e.g. `npm run dev`), then `node scripts/gen-og.mjs`.
// Optionally pass a base URL: `node scripts/gen-og.mjs http://localhost:3000`.
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3001";
const res = await fetch(`${base}/api/og`);
if (!res.ok) throw new Error(`GET ${base}/api/og → ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("public/og.png", buf);
console.log(`Wrote public/og.png (${buf.length} bytes) from ${base}/api/og`);
