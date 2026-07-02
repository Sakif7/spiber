/**
 * STAGE brand logos for review (step 1 of 2). READ-ONLY on your site.
 *
 * It logs in, lists your brands, and downloads a candidate logo for each one
 * into ./brand-logos/<slug>.<ext> so you can eyeball/replace them BEFORE they
 * go live. It never writes to the database — that's what apply-brand-logos does.
 *
 *   1. First run creates ./brand-logos/brands.csv (one row per brand, columns:
 *        slug, name, logoUrl, domain
 *      then stops. Fill in EITHER a direct image URL (logoUrl) OR a company
 *      domain (e.g. 3m.com) for the brands you want auto-fetched.
 *   2. Run again: it downloads a logo for every row that has a logoUrl or a
 *      domain, into ./brand-logos/. Review the folder; fix/replace wrong ones,
 *      drop in files (named <slug>.png) for any it missed.
 *   3. Then run: node scripts/apply-brand-logos.mjs --commit  (uploads + sets).
 *
 * Domain lookups use a logo service; the default (Clearbit) is keyless but
 * best-effort. Override for better coverage, e.g. Logo.dev / Brandfetch:
 *   --template "https://img.logo.dev/{domain}?token=pk_xxx"
 *   LOGO_URL_TEMPLATE="https://cdn.brandfetch.io/{domain}/w/512/h/512?c=CLIENTID"
 *
 * USAGE:
 *   node scripts/fetch-brand-logos.mjs --site https://spibermed.com --email you@x.com --password ****
 *   node scripts/fetch-brand-logos.mjs ... --refetch   # re-download even if a file exists
 */
import fs from "node:fs";
import path from "node:path";
import {
  requireConfig,
  login,
  fetchBrands,
  arg,
  LOGO_DIR,
  findStagedFile,
  extForContentType,
} from "./_brand-logos.mjs";

const CSV = path.join(LOGO_DIR, "brands.csv");
const TEMPLATE = String(
  arg("template", "LOGO_URL_TEMPLATE", "https://logo.clearbit.com/{domain}"),
);
const refetch = process.argv.includes("--refetch");

function parseCsv(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.length) continue;
    const cells = [];
    let cur = "",
      q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    out.push(cells);
  }
  return out;
}
const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const { site, email, password } = requireConfig();
  const { cookie, user } = await login(site, email, password);
  console.log(`Signed in as ${user?.email ?? "admin"} @ ${site}`);
  const brands = await fetchBrands(site, cookie);
  console.log(`${brands.length} brands found.\n`);
  fs.mkdirSync(LOGO_DIR, { recursive: true });

  if (!fs.existsSync(CSV)) {
    const rows = [
      ["slug", "name", "logoUrl", "domain"],
      ...brands.map((b) => [b.slug, b.name?.en ?? "", "", ""]),
    ];
    fs.writeFileSync(CSV, rows.map((r) => r.map(cell).join(",")).join("\n"));
    console.log(`Created ${path.relative(process.cwd(), CSV)}`);
    console.log(
      "Fill in a 'logoUrl' (direct image link) OR a 'domain' (e.g. 3m.com) " +
        "for each brand, then run this script again to download them.",
    );
    return;
  }

  const rows = parseCsv(fs.readFileSync(CSV, "utf8"));
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const col = (r, name) => r[header.indexOf(name)]?.trim() ?? "";

  let ok = 0,
    skip = 0,
    fail = 0,
    nosrc = 0;
  for (const r of rows) {
    const slug = col(r, "slug");
    if (!slug) continue;
    if (!refetch && findStagedFile(slug)) {
      skip++;
      continue;
    }
    const logoUrl = col(r, "logoUrl") || col(r, "logourl");
    const domain = col(r, "domain")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    const url = logoUrl || (domain ? TEMPLATE.replace("{domain}", domain) : "");
    if (!url) {
      nosrc++;
      continue;
    }
    try {
      const res = await fetch(url, { redirect: "follow" });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.startsWith("image/")) {
        console.log(`  MISS  ${slug} (${res.status}${ct ? ", " + ct : ""})`);
        fail++;
        continue;
      }
      const ext = extForContentType(ct);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) {
        console.log(`  MISS  ${slug} (empty/placeholder image)`);
        fail++;
        continue;
      }
      fs.writeFileSync(path.join(LOGO_DIR, `${slug}.${ext}`), buf);
      console.log(
        `  OK    ${slug}.${ext} (${Math.round(buf.length / 1024)} KB)`,
      );
      ok++;
    } catch (e) {
      console.log(`  ERR   ${slug} (${e.message})`);
      fail++;
    }
  }
  console.log(
    `\nDownloaded ${ok} · already staged ${skip} · no source ${nosrc} · failed ${fail}`,
  );
  console.log(
    `Review ${path.relative(process.cwd(), LOGO_DIR)}/ then run: node scripts/apply-brand-logos.mjs --commit`,
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
