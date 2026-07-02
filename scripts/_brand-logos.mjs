/**
 * Shared helpers for the brand-logo tooling (fetch-brand-logos + apply-brand-logos).
 * Everything runs against the LIVE site's admin API, so it is storage-agnostic
 * (works whether prod uses Cloudflare R2 or local disk) and needs only admin
 * credentials — no database or storage secrets.
 */
import fs from "node:fs";
import path from "node:path";

/** Read KEY=VALUE lines from .env.local for anything not already in the env. */
export function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

/** `--flag value` (or bare `--flag` → true), else env FALLBACK, else default. */
export function arg(name, envName, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) {
    const v = process.argv[i + 1];
    return v && !v.startsWith("--") ? v : true;
  }
  return process.env[envName] ?? def;
}

export function requireConfig() {
  loadEnvLocal();
  // Positional fallback: `npm run x -- --site A --email B --password C` gets
  // mangled by npm (it strips the --flag names and forwards only the values),
  // so the script receives them positionally in the order: site email password.
  const pos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const site = String(arg("site", "SITE_URL", pos[0] ?? "")).replace(/\/$/, "");
  const email = arg("email", "ADMIN_EMAIL", pos[1] ?? "");
  const password = arg("password", "ADMIN_PASSWORD", pos[2] ?? "");
  const missing = [];
  if (!site) missing.push("--site / SITE_URL");
  if (!email) missing.push("--email / ADMIN_EMAIL");
  if (!password) missing.push("--password / ADMIN_PASSWORD");
  if (missing.length) {
    console.error("Missing required config: " + missing.join(", "));
    console.error(
      "Run it directly (npm mangles the flags):\n" +
        "  node scripts/fetch-brand-logos.mjs --site https://spibermed.com --email you@x.com --password ****",
    );
    process.exit(1);
  }
  return { site, email, password };
}

/** Log in as admin and return the session cookie string to reuse on requests. */
export async function login(site, email, password) {
  const res = await fetch(`${site}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}). Check the site URL + admin credentials.`,
    );
  }
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Login returned no session cookie.");
  const json = await res.json().catch(() => null);
  return { cookie, user: json?.data?.user };
}

/** Fetch all brands from the admin API: [{ id, name:{en,bn,ja}, slug, logo }]. */
export async function fetchBrands(site, cookie) {
  const res = await fetch(`${site}/api/admin/brands`, { headers: { cookie } });
  if (!res.ok) throw new Error(`Could not list brands (${res.status}).`);
  const json = await res.json();
  return json?.data?.brands ?? [];
}

export const LOGO_DIR = path.join(process.cwd(), "brand-logos");
const IMG_EXTS = ["png", "webp", "jpg", "jpeg", "avif", "svg"];

/** Find a staged logo file for a slug (brand-logos/<slug>.<ext>), or null. */
export function findStagedFile(slug) {
  for (const ext of IMG_EXTS) {
    const p = path.join(LOGO_DIR, `${slug}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function extForContentType(ct = "") {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("svg")) return "svg";
  return "png";
}
