/**
 * APPLY staged brand logos to your LIVE site (step 2 of 2).
 *
 * For every brand it finds a matching file at ./brand-logos/<slug>.<ext>, it
 * uploads the image through the site's own upload endpoint (so it lands in
 * whatever storage prod uses — Cloudflare R2 or local disk) and sets the
 * brand's logo. Only admin credentials are needed; no DB or storage secrets.
 *
 * SAFE BY DEFAULT: a dry run (no --commit) just prints what it WOULD do.
 * IDEMPOTENT: brands that already have a logo are skipped unless --force, so a
 * re-run only fills in the missing ones.
 *
 * USAGE:
 *   node scripts/apply-brand-logos.mjs --site https://spibermed.com --email you@x.com --password ****
 *       -> dry run: shows the plan, writes nothing
 *   node scripts/apply-brand-logos.mjs ... --commit         -> upload + set logos
 *   node scripts/apply-brand-logos.mjs ... --commit --force  -> also overwrite existing logos
 *
 * Note: SVG is not accepted by the upload endpoint (XSS-safety) — use PNG/WebP/JPG.
 */
import fs from "node:fs";
import path from "node:path";
import {
  requireConfig,
  login,
  fetchBrands,
  findStagedFile,
} from "./_brand-logos.mjs";

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

const commit = process.argv.includes("--commit");
const force = process.argv.includes("--force");

async function uploadImage(site, cookie, filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type }), path.basename(filePath));
  const res = await fetch(`${site}/api/admin/uploads`, {
    method: "POST",
    headers: { cookie },
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.code ?? `upload ${res.status}`);
  }
  return json.data.url;
}

async function setLogo(site, cookie, brand, url) {
  const res = await fetch(`${site}/api/admin/brands/${brand.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ name: brand.name, slug: brand.slug, logo: url }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.code ?? `patch ${res.status}`);
  }
}

async function main() {
  const { site, email, password } = requireConfig();
  const { cookie, user } = await login(site, email, password);
  console.log(`Signed in as ${user?.email ?? "admin"} @ ${site}`);
  console.log(
    commit ? "MODE: COMMIT (writing)\n" : "MODE: DRY RUN (no writes)\n",
  );

  const brands = await fetchBrands(site, cookie);
  let done = 0,
    skipHas = 0,
    noFile = 0,
    svg = 0,
    fail = 0,
    plan = 0;

  for (const b of brands) {
    const file = findStagedFile(b.slug);
    if (!file) {
      noFile++;
      continue;
    }
    if (path.extname(file).toLowerCase() === ".svg") {
      console.log(`  SVG   ${b.slug} — convert to PNG/WebP (SVG not accepted)`);
      svg++;
      continue;
    }
    if (b.logo && !force) {
      skipHas++;
      continue;
    }
    const rel = path.relative(process.cwd(), file);
    if (!commit) {
      console.log(
        `  PLAN  ${b.slug}  <-  ${rel}${b.logo ? " (replaces existing)" : ""}`,
      );
      plan++;
      continue;
    }
    try {
      const url = await uploadImage(site, cookie, file);
      await setLogo(site, cookie, b, url);
      console.log(`  SET   ${b.slug}  ->  ${url}`);
      done++;
    } catch (e) {
      console.log(`  FAIL  ${b.slug} (${e.message})`);
      fail++;
    }
  }

  console.log("");
  if (commit) {
    console.log(
      `Applied ${done} · already had a logo ${skipHas} · no staged file ${noFile} · svg-skipped ${svg} · failed ${fail}`,
    );
  } else {
    console.log(
      `Would apply ${plan} · already had a logo ${skipHas} · no staged file ${noFile} · svg-skipped ${svg}`,
    );
    console.log("Re-run with --commit to apply.");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
