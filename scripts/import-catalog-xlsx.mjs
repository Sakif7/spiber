/**
 * Import the client's medical-equipment catalog (SPIBER MED WEBSITE.xlsx) into
 * Brands, Categories, and Products.
 *
 * SOURCE LAYOUT (7 sheets):
 *   Each sheet  -> one Instruments top-level category.
 *   Lettered sections (A, B, C…) within a sheet -> subcategories.
 *   Columns: A=S/N, B=item description, C=model, D="brand + origin",
 *            E="E-COMMERCE" flag (marks marketplace items).
 *
 * FIELD MAPPING (project decision 2026-06-05, revised):
 *   name        = MODEL (col C) — the product's identity. (Col B repeats per
 *                 section, so it is NOT the name.) Falls back to col B only for
 *                 the few rows whose model cell is a stray catalog number.
 *   description = the TYPE text (col B, e.g. "ECG Machine (12 Lead)").
 *   brand       = manufacturer from col D (deduped); origin -> "Country of
 *                 Origin" spec. Model is NOT duplicated as a spec.
 *   A (S/N) is ignored (row counter / stray catalog refs).
 *
 * PLACEMENT (project decision 2026-06-05):
 *   - ALL products  -> Instruments storefront (B2B quote-only catalog).
 *   - Items flagged E-COMMERCE are ALSO duplicated into the Marketplace
 *     storefront (buyable), nested under the existing Marketplace "Medical"
 *     top category. A dual-listed item becomes two linked records with
 *     parallel SKUs (INS-… / MKT-…).
 *
 * The source has NO prices and NO images, so every product imports as
 *   status:"draft", priceMinor:null, images:[]
 * for the admin to complete in the UI later. Brand country-of-origin is kept
 * as a product spec ("Country of Origin") because Brand has no origin field.
 *
 * USAGE:
 *   npm run import-catalog                          # DRY RUN — parse + report, no DB writes
 *   npm run import-catalog -- --commit              # write to local Mongo (idempotent)
 *   npm run import-catalog -- --commit --force-prod # write to a NON-local Mongo
 *   npm run import-catalog -- --file "path/to.xlsx" # custom source file
 *   npm run import-catalog -- --out preview.json    # also dump the full plan to JSON
 *   npm run import-catalog -- --commit --keep-file  # don't delete the source after seeding
 *
 * On a successful --commit the source .xlsx is DELETED (the catalog now lives in
 * the DB); pass --keep-file to retain it. A dry run never deletes anything.
 *
 * IDEMPOTENT: products upsert by SKU with $setOnInsert, so re-running NEVER
 * clobbers prices/images/status the admin curated — it only inserts products
 * that don't exist yet. Brands/categories find-or-create by slug. (Note: once
 * the file is deleted, re-running needs --file pointing at another copy.)
 *
 * Reads MONGODB_URI / MONGODB_DB from env, falling back to .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

// ───────────────────────── env ─────────────────────────
function loadEnvLocal() {
  if (process.env.MONGODB_URI) return;
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

// ──────────────────── minimal xlsx reader ────────────────────
// xlsx is a ZIP of XML parts. No third-party dep: read the central directory
// and inflate each entry with zlib. Sufficient for this single workbook.
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip (EOCD not found)");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50)
      throw new Error("bad central directory entry");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? Buffer.from(comp) : zlib.inflateRawSync(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, "&");
}

function readSharedStrings(xml) {
  const out = [];
  if (!xml) return out;
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    let txt = "";
    while ((t = tRe.exec(m[1]))) txt += decodeXml(t[1]);
    out.push(txt);
  }
  return out;
}

function readSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = {};
    const cRe =
      /<c r="([A-Z]+)\d+"(?:[^>]*?t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cRe.exec(rm[2]))) {
      const [, col, type, inner] = cm;
      const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
      const isM = /<is>([\s\S]*?)<\/is>/.exec(inner);
      let val = "";
      if (type === "s" && vm) val = shared[+vm[1]] ?? "";
      else if (type === "inlineStr" && isM) {
        const tm = /<t[^>]*>([\s\S]*?)<\/t>/.exec(isM[1]);
        val = tm ? decodeXml(tm[1]) : "";
      } else if (vm) val = decodeXml(vm[1]);
      cells[col] = val;
    }
    rows.push({ r: +rm[1], cells });
  }
  return rows;
}

/** Resolve sheet display-name -> rows, via workbook.xml + its rels. */
function readWorkbook(files) {
  const wb = files["xl/workbook.xml"].toString("utf8");
  const rels = files["xl/_rels/workbook.xml.rels"].toString("utf8");
  const relMap = {};
  for (const m of rels.matchAll(
    /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g,
  )) {
    relMap[m[1]] = m[2];
  }
  const shared = readSharedStrings(
    files["xl/sharedStrings.xml"]?.toString("utf8"),
  );
  const sheets = {};
  for (const m of wb.matchAll(
    /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g,
  )) {
    const target = relMap[m[2]];
    const key = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const xml = files[key]?.toString("utf8");
    if (xml) sheets[decodeXml(m[1]).trim()] = readSheet(xml, shared);
  }
  return sheets;
}

// ──────────────────── normalization helpers ────────────────────
const clean = (s) =>
  (s ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
const isSectionLetter = (v) => /^[A-Z]$/.test(clean(v));

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A model cell that is purely a number is a stray catalog serial, not a model. */
function realModel(raw) {
  const m = clean(raw).replace(/[\s\-–—,:]+$/, "");
  if (!m || /^\d+$/.test(m)) return "";
  return m;
}

const COUNTRIES = [
  "China",
  "Japan",
  "India",
  "USA",
  "Germany",
  "Switzerland",
  "Italy",
  "Netherlands",
  "South Korea",
  "Korea",
  "Taiwan",
  "France",
  "UK",
  "Spain",
  "Belgium",
  "Austria",
  "Canada",
  "Singapore",
];
const COUNTRY_RE = new RegExp(`\\b(${COUNTRIES.join("|")})\\b\\s*$`, "i");

// Merge obvious duplicate spellings to one canonical brand.
const BRAND_ALIASES = {
  ge: "GE Healthcare",
  "ge healthcare": "GE Healthcare",
  human: "Human GmbH",
  "human-gmbh": "Human GmbH",
  elitech: "Elitech",
  "elitech group": "Elitech",
  benq: "BenQ",
  "benq taiwan": "BenQ",
  drager: "Dräger",
  shimadzu: "Shimadzu",
  "mizhu coorporation": "Mizhu Corporation",
  ari: "Ari",
};

function normalizeCountry(c) {
  const t = clean(c);
  if (/^korea$/i.test(t)) return "South Korea";
  if (/^usa$/i.test(t)) return "USA";
  if (/^uk$/i.test(t)) return "UK";
  return t.replace(/\b\w/g, (x) => x.toUpperCase()).replace(/Usa/i, "USA");
}

/** "Nihon Kohden, Japan" | "Saikang Medical China" -> { brand, origin }. */
function parseBrandOrigin(raw) {
  const v = clean(raw);
  if (!v) return { brand: "", origin: "" };
  // comma form
  const comma = v.split(",");
  if (comma.length >= 2) {
    const tail = clean(comma[comma.length - 1]);
    if (COUNTRIES.some((c) => c.toLowerCase() === tail.toLowerCase())) {
      return {
        brand: clean(comma.slice(0, -1).join(",")),
        origin: normalizeCountry(tail),
      };
    }
  }
  // trailing-country form (no comma)
  const m = COUNTRY_RE.exec(v);
  if (m) {
    return {
      brand: clean(v.slice(0, m.index)),
      origin: normalizeCountry(m[1]),
    };
  }
  return { brand: v, origin: "" };
}

function canonicalBrand(brand) {
  const key = brand.toLowerCase().trim();
  return BRAND_ALIASES[key] ?? brand.trim();
}

// ──────────────────── catalog model ────────────────────
const SHEETS = [
  {
    sheet: "M. FURNITURE",
    code: "FUR",
    title: { en: "Medical Furniture", bn: "মেডিকেল ফার্নিচার" },
  },
  {
    sheet: "PCMS",
    code: "PCM",
    title: {
      en: "Patient Care Monitoring System",
      bn: "পেশেন্ট কেয়ার মনিটরিং সিস্টেম",
    },
  },
  {
    sheet: "CCU",
    code: "CCU",
    title: { en: "Critical Care", bn: "ক্রিটিক্যাল কেয়ার" },
  },
  {
    sheet: "OT-S",
    code: "OTS",
    title: { en: "OR Solution", bn: "অপারেশন থিয়েটার সলিউশন" },
  },
  {
    sheet: "SURGICAL",
    code: "SUR",
    title: { en: "Surgical Solution", bn: "সার্জিক্যাল সলিউশন" },
  },
  {
    sheet: "M. IMAGE",
    code: "IMG",
    title: { en: "Medical Imaging System", bn: "মেডিকেল ইমেজিং সিস্টেম" },
  },
  {
    sheet: "LAB",
    code: "LAB",
    title: { en: "In-Vitro Diagnostics (Lab)", bn: "ল্যাব ডায়াগনস্টিকস" },
  },
];

// Marketplace "Medical" top (find-or-create) + the new subcategories the
// e-commerce items nest under.
const MP_MEDICAL = {
  key: "mp-medical",
  slug: "medical",
  name: { en: "Medical", bn: "মেডিকেল" },
  icon: "stethoscope",
};
const MP_SUBS = {
  furniture: {
    key: "mp-furniture",
    slug: "medical-hospital-furniture",
    name: { en: "Hospital Furniture" },
    icon: "bed",
  },
  monitoring: {
    key: "mp-monitoring",
    slug: "medical-patient-monitoring",
    name: { en: "Patient Monitoring" },
    icon: "activity",
  },
  pumps: {
    key: "mp-pumps",
    slug: "medical-infusion-syringe-pumps",
    name: { en: "Infusion & Syringe Pumps" },
    icon: "syringe",
  },
};

/** Which Marketplace subcategory an e-commerce item belongs to. */
function mpSubKey(sheet, section) {
  if (sheet === "M. FURNITURE") return "furniture";
  if (sheet === "PCMS") {
    if (/infusion|syringe|pump/i.test(section)) return "pumps";
    return "monitoring"; // ECG + Cardiac Monitor
  }
  return "monitoring";
}

/** Walk every sheet into a flat list of source products with context. */
function extractProducts(sheets) {
  const items = [];
  for (const cfg of SHEETS) {
    const rows = sheets[cfg.sheet];
    if (!rows) throw new Error(`sheet "${cfg.sheet}" not found in workbook`);
    const hdr = rows.findIndex((r) =>
      Object.values(r.cells).some((v) => clean(v) === "S/N"),
    );
    let section = "";
    let seq = 0;
    for (const r of rows.slice(hdr + 1)) {
      const A = clean(r.cells.A);
      const B = clean(r.cells.B);
      const C = clean(r.cells.C);
      const D = clean(r.cells.D);
      const E = clean(r.cells.E);
      if (!A && !B && !C && !D && !E) continue;
      if (isSectionLetter(r.cells.A) && B && !C && !D) {
        section = B;
        continue;
      }
      const hasContent = C || D || (B && !isSectionLetter(r.cells.A));
      if (!hasContent) continue;
      seq += 1;
      const { brand, origin } = parseBrandOrigin(D);
      items.push({
        sheet: cfg.sheet,
        code: cfg.code,
        topTitle: cfg.title,
        section,
        seq,
        desc: B,
        model: realModel(C),
        brandRaw: brand,
        brand: brand ? canonicalBrand(brand) : "",
        origin,
        ecom: /e-?commerce/i.test(E),
      });
    }
  }
  return items;
}

// The product's identity is its MODEL (col C). The type text (col B) is the
// description, the brand has its own field. Fall back to the type only for the
// few rows whose model cell was a stray catalog number (dropped by realModel).
function productName(p) {
  if (p.model) return p.model;
  if (p.desc) return clean(p.desc);
  if (p.brand) return p.brand;
  return "Untitled product";
}

// ──────────────────── build the import plan ────────────────────
export function buildPlan(sheets) {
  const items = extractProducts(sheets);

  // Brands (deduped canonical).
  const brandMap = new Map(); // canonical -> { canonical, name, slug }
  for (const p of items) {
    if (!p.brand || brandMap.has(p.brand)) continue;
    brandMap.set(p.brand, {
      canonical: p.brand,
      name: { en: p.brand },
      slug: slugify(p.brand),
    });
  }

  // Categories. Instruments tops + section subs, plus the Marketplace nodes.
  const cats = []; // { key, slug, name, parentKey, storefront, icon, position, findFirst }
  const catKeyByTopSheet = {};
  const catKeyBySection = {}; // `${sheet}::${section}` -> key
  SHEETS.forEach((cfg, i) => {
    const topKey = `ins-${cfg.code}`;
    catKeyByTopSheet[cfg.sheet] = topKey;
    cats.push({
      key: topKey,
      slug: slugify(cfg.title.en),
      name: cfg.title,
      parentKey: null,
      storefront: "instruments",
      icon: undefined,
      position: i,
      featured: true,
    });
  });
  // Section subcategories, in first-seen order per sheet.
  const subSeen = new Map(); // sheet -> position counter
  for (const p of items) {
    if (!p.section) continue;
    const id = `${p.sheet}::${p.section}`;
    if (catKeyBySection[id]) continue;
    const pos = subSeen.get(p.sheet) ?? 0;
    subSeen.set(p.sheet, pos + 1);
    const fixed = fixTypos(p.section);
    const key = `${catKeyByTopSheet[p.sheet]}-${slugify(fixed)}`;
    catKeyBySection[id] = key;
    cats.push({
      key,
      slug: slugify(`${p.code} ${fixed}`),
      name: { en: titleCaseSection(fixed) },
      parentKey: catKeyByTopSheet[p.sheet],
      storefront: "instruments",
      position: pos,
      featured: false,
    });
  }
  // Marketplace "Medical" top (find-or-create) + subs actually used.
  const usedMpSubs = new Set();
  for (const p of items)
    if (p.ecom) usedMpSubs.add(mpSubKey(p.sheet, p.section));
  cats.push({
    key: MP_MEDICAL.key,
    slug: MP_MEDICAL.slug,
    name: MP_MEDICAL.name,
    parentKey: null,
    storefront: "marketplace",
    icon: MP_MEDICAL.icon,
    position: 0,
    featured: true,
    findFirst: true, // reuse the existing seeded "Medical" node if present
  });
  let mpPos = 10;
  for (const k of ["furniture", "monitoring", "pumps"]) {
    if (!usedMpSubs.has(k)) continue;
    const sub = MP_SUBS[k];
    cats.push({
      key: sub.key,
      slug: sub.slug,
      name: sub.name,
      parentKey: MP_MEDICAL.key,
      storefront: "marketplace",
      icon: sub.icon,
      position: mpPos++,
      featured: false,
      findFirst: true,
    });
  }

  // Products. Instruments record for every item; a Marketplace twin for ecom.
  const products = [];
  for (const p of items) {
    const name = productName(p);
    // The type text (col B) becomes the description — but only when it isn't
    // already serving as the name (the stray-numeric-model rows), to avoid
    // name === description duplication.
    const description = p.model ? clean(p.desc) || null : null;
    // Model is the name now, so it is NOT repeated as a spec. Origin only.
    const specs = [];
    if (p.origin)
      specs.push({
        key: { en: "Country of Origin" },
        value: { en: p.origin },
      });

    const insCatKey = p.section
      ? catKeyBySection[`${p.sheet}::${p.section}`]
      : catKeyByTopSheet[p.sheet];
    const insSku = `INS-${p.code}-${String(p.seq).padStart(3, "0")}`;
    products.push(
      makeProduct({
        sku: insSku,
        name,
        description,
        specs,
        brand: p.brand,
        catKey: insCatKey,
        storefront: "instruments",
      }),
    );

    if (p.ecom) {
      const mpSku = `MKT-${p.code}-${String(p.seq).padStart(3, "0")}`;
      products.push(
        makeProduct({
          sku: mpSku,
          name,
          description,
          specs,
          brand: p.brand,
          catKey: MP_SUBS[mpSubKey(p.sheet, p.section)].key,
          storefront: "marketplace",
        }),
      );
    }
  }

  return {
    items,
    brands: [...brandMap.values()],
    categories: cats,
    products,
  };
}

function makeProduct({
  sku,
  name,
  description,
  specs,
  brand,
  catKey,
  storefront,
}) {
  return {
    sku,
    name: { en: name },
    description: description || null,
    slug: `${slugify(name).slice(0, 90)}-${sku.toLowerCase()}`,
    brandCanonical: brand || null,
    catKey,
    storefront,
    specs,
  };
}

// Whole-word spelling fixes for the few typos in the source sheet headers,
// applied to category display names AND slugs.
const SECTION_TYPOS = { infsuion: "Infusion", prtein: "Protein" };
function fixTypos(s) {
  return clean(s).replace(
    /\b([A-Za-z]+)\b/g,
    (w) => SECTION_TYPOS[w.toLowerCase()] ?? w,
  );
}

function titleCaseSection(s) {
  // Section headers are SHOUTED in the sheet; present them in Title Case but
  // keep short all-caps tokens (ECG, ESU, ABG, ICU, NICU, MRI, CT, MIS, HBA1C…).
  return clean(s)
    .toLowerCase()
    .replace(/\b([a-z0-9]+)\b/g, (w) =>
      /^(ecg|esu|abg|icu|ccu|hdu|nicu|mri|ct|mis|esr|hba1c|ivd|or|ot|fm)$/i.test(
        w,
      )
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    );
}

// ──────────────────── reporting ────────────────────
function report(plan) {
  const ins = plan.products.filter((p) => p.storefront === "instruments");
  const mkt = plan.products.filter((p) => p.storefront === "marketplace");
  const noBrand = plan.items.filter((i) => !i.brand).length;
  const droppedModels = plan.items.filter(
    (i) => !i.model && /\d/.test(i.section + i.desc) === false,
  );

  console.log("\n══════════ Spiber catalog import — DRY RUN ══════════\n");
  console.log(`Source items parsed : ${plan.items.length}`);
  console.log(
    `  e-commerce flagged: ${plan.items.filter((i) => i.ecom).length}`,
  );
  console.log(`Brands (deduped)    : ${plan.brands.length}`);
  const insTops = plan.categories.filter(
    (c) => c.storefront === "instruments" && !c.parentKey,
  ).length;
  const insSubs = plan.categories.filter(
    (c) => c.storefront === "instruments" && c.parentKey,
  ).length;
  const mpCats = plan.categories.filter((c) => c.storefront === "marketplace");
  console.log(
    `Categories          : ${plan.categories.length}  (instruments ${insTops} tops + ${insSubs} subs, marketplace ${mpCats.length})`,
  );
  console.log(
    `Products            : ${plan.products.length}  (instruments ${ins.length}, marketplace ${mkt.length})\n`,
  );

  console.log("Instruments categories:");
  for (const t of plan.categories.filter(
    (c) => c.storefront === "instruments" && !c.parentKey,
  )) {
    const subs = plan.categories.filter((c) => c.parentKey === t.key);
    const n = ins.filter(
      (p) => p.catKey === t.key || subs.some((s) => s.key === p.catKey),
    ).length;
    console.log(`  • ${t.name.en}  [${n} products]  /${t.slug}`);
    for (const s of subs) {
      const sn = ins.filter((p) => p.catKey === s.key).length;
      console.log(`      – ${s.name.en} (${sn})  /${s.slug}`);
    }
    if (!subs.length) {
      // furniture: products on the top node
    }
  }
  console.log("\nMarketplace categories (nested under Medical):");
  for (const c of mpCats.filter((c) => c.parentKey)) {
    const n = mkt.filter((p) => p.catKey === c.key).length;
    console.log(`  • Medical › ${c.name.en} (${n})  /${c.slug}`);
  }

  console.log("\nData notes:");
  console.log(
    `  • Name = model (col C); type (col B) = description; origin (col D) = spec.`,
  );
  console.log(`  • ${noBrand} products have no brand (brand left empty).`);
  console.log(
    `  • Stray numeric "model" cells dropped → those rows fall back to the type for their name.`,
  );
  console.log(
    `  • All products import as status:"draft", priceMinor:null, images:[].`,
  );

  console.log("\nSample products:");
  for (const p of [ins[0], ins[1], mkt[0], mkt[mkt.length - 1]].filter(
    Boolean,
  )) {
    const cat = plan.categories.find((c) => c.key === p.catKey);
    console.log(
      `  [${p.storefront}] ${p.sku}  name="${p.name.en}"  desc="${p.description ?? "—"}"  brand=${p.brandCanonical ?? "—"}  cat=${cat?.slug}  specs=${p.specs.map((s) => `${s.key.en}:${s.value.en}`).join("; ") || "—"}`,
    );
  }
  void droppedModels;
}

// ──────────────────── commit ────────────────────
const LOCAL_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "mongo",
  "host.docker.internal",
];
function hostIsLocal(u) {
  try {
    return LOCAL_HOSTS.includes(
      new URL(u.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname,
    );
  } catch {
    return false;
  }
}

export async function commitPlan(plan, { uri, dbName, forceProd = false }) {
  const { MongoClient } = await import("mongodb");
  if (!hostIsLocal(uri) && !forceProd) {
    throw new Error(
      "Refusing: target Mongo host is not local. Re-run with --force-prod to write to it.",
    );
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const now = new Date();

    // Brands — find-or-create by slug.
    const brandId = {};
    for (const b of plan.brands) {
      await db.collection("brands").updateOne(
        { slug: b.slug, deletedAt: null },
        {
          $setOnInsert: {
            name: b.name,
            slug: b.slug,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      const doc = await db
        .collection("brands")
        .findOne({ slug: b.slug, deletedAt: null });
      brandId[b.canonical] = doc._id;
    }

    // Categories — parents first, find-or-create by slug.
    const catId = {};
    const ordered = [
      ...plan.categories.filter((c) => !c.parentKey),
      ...plan.categories.filter((c) => c.parentKey),
    ];
    for (const c of ordered) {
      const filter = { slug: c.slug, deletedAt: null };
      const setOnInsert = {
        name: c.name,
        slug: c.slug,
        parentId: c.parentKey ? catId[c.parentKey] : null,
        storefront: c.storefront,
        position: c.position,
        featured: !!c.featured,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      if (c.icon) setOnInsert.icon = c.icon;
      await db
        .collection("categories")
        .updateOne(filter, { $setOnInsert: setOnInsert }, { upsert: true });
      const doc = await db.collection("categories").findOne(filter);
      catId[c.key] = doc._id;
    }

    // Products — upsert by sku with $setOnInsert (never clobber curated edits).
    const ops = plan.products.map((p) => ({
      updateOne: {
        filter: { sku: p.sku, deletedAt: null },
        update: {
          $setOnInsert: {
            sku: p.sku,
            name: p.name,
            description: p.description ? { en: p.description } : null,
            slug: p.slug,
            brandId: p.brandCanonical ? brandId[p.brandCanonical] : null,
            categoryId: catId[p.catKey],
            storefront: p.storefront,
            specs: p.specs,
            images: [],
            priceMinor: null,
            stockQty: 0,
            lowStockThreshold: 5,
            status: "draft",
            featured: false,
            variantOptions: [],
            variants: [],
            ratingAvg: 0,
            ratingCount: 0,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));
    const res = await db
      .collection("products")
      .bulkWrite(ops, { ordered: false });
    const inserted = res.upsertedCount ?? 0;

    return {
      brands: plan.brands.length,
      categories: plan.categories.length,
      productsInserted: inserted,
      productsSkipped: plan.products.length - inserted,
    };
  } finally {
    await client.close();
  }
}

// ──────────────────── source-file resolution + plan ────────────────────
export function readPlanFromFile(file) {
  const buf = fs.readFileSync(file);
  const sheets = readWorkbook(unzip(buf));
  return buildPlan(sheets);
}

function resolveFile(explicit) {
  const candidates = explicit
    ? [explicit]
    : [
        "SPIBER MED WEBSITE.xlsx",
        path.join("data", "SPIBER MED WEBSITE.xlsx"),
        path.join("scripts", "SPIBER MED WEBSITE.xlsx"),
      ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(
    `source .xlsx not found (looked for: ${candidates.join(", ")}). Pass --file <path>.`,
  );
}

// ──────────────────── CLI ────────────────────
async function main() {
  loadEnvLocal();
  const argv = process.argv.slice(2);
  const COMMIT = argv.includes("--commit");
  const FORCE_PROD = argv.includes("--force-prod");
  const KEEP_FILE = argv.includes("--keep-file");
  const fileArg = argFlag(argv, "--file");
  const outArg = argFlag(argv, "--out");

  const file = resolveFile(fileArg);
  console.log(`Source: ${file}`);
  const plan = readPlanFromFile(file);

  // Sanity: no duplicate SKUs or slugs within the plan.
  assertUnique(
    plan.products.map((p) => p.sku),
    "product SKU",
  );
  assertUnique(
    plan.products.map((p) => p.slug),
    "product slug",
  );
  assertUnique(
    plan.categories.map((c) => c.slug),
    "category slug",
  );

  report(plan);

  if (outArg) {
    fs.writeFileSync(outArg, JSON.stringify(plan, null, 2));
    console.log(`\nFull plan written to ${outArg}`);
  }

  if (!COMMIT) {
    console.log(
      "\nDry run only. Re-run with --commit to write to Mongo (idempotent).\n",
    );
    return;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "spiber";
  if (!uri)
    throw new Error("MONGODB_URI not set (checked env and .env.local).");
  console.log(
    `\nCommitting to "${dbName}" @ ${new URL(uri.replace("mongodb+srv://", "mongodb://")).hostname} …`,
  );
  const r = await commitPlan(plan, { uri, dbName, forceProd: FORCE_PROD });
  console.log(
    `\n✓ Done. brands=${r.brands}, categories=${r.categories}, products inserted=${r.productsInserted}, already-present=${r.productsSkipped}.`,
  );
  console.log("Run `npm run sync-indexes` if this is a fresh database.");

  // Delete the source workbook now that it's been seeded into the DB. The plan
  // is fully persisted, so the file is no longer needed. Only ever happens on a
  // successful --commit (never on a dry run); skip with --keep-file.
  if (KEEP_FILE) {
    console.log(`Kept source file (\`--keep-file\`): ${file}\n`);
  } else {
    fs.rmSync(file, { force: true });
    console.log(`Deleted source file after seeding: ${file}\n`);
  }
}

function argFlag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function assertUnique(arr, label) {
  const seen = new Set();
  const dupes = new Set();
  for (const v of arr) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  if (dupes.size)
    throw new Error(
      `duplicate ${label}(s): ${[...dupes].slice(0, 5).join(", ")}`,
    );
}

// Run as a script (not when imported by the verifier).
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error("\n✗", err.message);
    process.exit(1);
  });
}
