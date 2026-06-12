/**
 * Seed Medtrade (instruments) SUBCATEGORIES under several existing top-level
 * categories, from the client's "SPIBER MED TRADE" category document.
 *
 * SCOPE (confirmed with the client)
 *   - TWO levels only: each top category → its subcategories. (The document's
 *     "Patient Care Monitoring System" also lists a 3rd level under each
 *     subcategory; those deepest items are intentionally NOT seeded — the nav
 *     renders category → subcategory → products, so a 3rd category level would
 *     never surface there.)
 *   - ATTACH TO EXISTING top categories. Each menu is matched to an existing
 *     instruments top category by normalized name (with aliases for the small
 *     naming differences, e.g. "Critical Care Unit" → "Critical Care",
 *     "In-Vitro Diagnostic (IVD)" → "In-Vitro Diagnostics (Lab)"). A menu with
 *     no existing match is REPORTED and skipped — unless you pass
 *     --create-missing, which creates the top category (named by its first
 *     alias) and then fills in its subcategories.
 *
 * IDEMPOTENT
 *   Subcategories are matched to existing ones under the SAME parent by
 *   normalized NAME (not slug), so re-running never duplicates and never
 *   clobbers anything an admin renamed/reordered — only missing ones are
 *   inserted (appended after the last existing subcategory). Slugs are made
 *   GLOBALLY unique on insert (a numeric suffix is appended only if the base
 *   slug is already taken by another category), since category slugs are
 *   unique site-wide. Existing products stay where they are — this script only
 *   touches categories.
 *
 * USAGE
 *   node scripts/seed-medtrade-categories.mjs                          # DRY RUN
 *   node scripts/seed-medtrade-categories.mjs --commit                 # write (local Mongo)
 *   node scripts/seed-medtrade-categories.mjs --commit --force-prod    # write to a NON-local Mongo
 *   node scripts/seed-medtrade-categories.mjs --commit --create-missing # also create unmatched top categories
 *
 *   ⚠ PowerShell: `npm run seed-medtrade-cats -- --commit` SILENTLY DROPS the
 *   flag (PowerShell consumes the `--`, so npm never forwards `--commit` and you
 *   get a DRY RUN). Call node directly as above, or quote it:
 *   `npm run seed-medtrade-cats "--" "--commit"`. The flags only attach to the
 *   EXISTING top categories, which live in PROD — a minimal local/dev DB will
 *   report "no match" for all of them (add --create-missing to seed them anyway).
 *
 * Guards (mirror the other seed scripts):
 *   - refuses to write without --commit (prints the plan, then exits),
 *   - refuses against a non-local Mongo host without --force-prod.
 *
 * Reads MONGODB_URI / MONGODB_DB from env, falling back to .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

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

loadEnvLocal();

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);

const COMMIT = has("--commit");
const FORCE_PROD = has("--force-prod");
const CREATE_MISSING = has("--create-missing");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spiber";
if (!uri) {
  console.error("MONGODB_URI is not set (checked env and .env.local).");
  process.exit(1);
}

const LOCAL_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "mongo",
  "host.docker.internal",
];
function hostIsLocal(u) {
  try {
    const h = new URL(u.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname;
    return LOCAL_HOSTS.includes(h);
  } catch {
    return false;
  }
}

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Compare names ignoring case, "&"/"and", and punctuation/spacing so existing
// categories are matched robustly however they were originally typed.
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * The document, transcribed as 2 levels. `aliases` are the candidate names used
 * to find the EXISTING top category (first alias is also the name used if it
 * must be created). Source typos are corrected here (display + slug only):
 *   "CT-San" → "CT-Scan", "Imgaing" → "Imaging".
 */
const MENUS = [
  {
    aliases: [
      "Patient Care Monitoring System",
      "Patient Care & Monitoring System",
    ],
    subcategories: [
      "Multiparameter Patient Monitors",
      "Central Monitoring Systems",
      "Vital Signs Monitors",
      "ECG & Cardiac Monitoring",
      "Pulse Oximetry",
      "Fetal & Maternal Monitoring",
      "Neonatal Monitoring",
      "Capnography Monitoring",
      "Anesthesia & Gas Monitoring",
      "Ambulatory & Home Monitoring",
      "Accessories & Consumables",
    ],
  },
  {
    aliases: ["Critical Care", "Critical Care Unit", "Critical Care (CCU)"],
    subcategories: [
      "Ventilator",
      "C-PAP",
      "Bi-PAP",
      "Incubator",
      "Warmer",
      "Defibrillator",
    ],
  },
  {
    aliases: ["OR Solution", "OR Solutions", "Operating Room Solution"],
    subcategories: [
      "Modular Operation Theater",
      "Operating Table",
      "Surgical Lighting Systems",
      "Anesthesia Solution",
      "Patient Monitoring Systems",
      "Endoscopy & Laparoscopy",
      "Electrosurgical & Energy Devices",
      "Imaging for OR",
      "Medical Gas Pipeline System (MGPS)",
      "Sterilization & Infection Control",
      "OR Integration & Digital Solutions",
    ],
  },
  {
    aliases: ["Medical Imaging System", "Medical Imaging", "Imaging System"],
    subcategories: [
      "X-Ray Systems",
      "Ultrasound Systems",
      "Mobile C-Arm",
      "CT-Scan",
      "MRI",
      "Mammography",
      "Interventional Imaging",
      "Dental Imaging",
      "Imaging Accessories",
      "Imaging Software & IT Solutions",
      "Refurbished Imaging Equipment",
    ],
  },
  {
    aliases: [
      "In-Vitro Diagnostics (Lab)",
      "In-Vitro Diagnostic (IVD)",
      "In-Vitro Diagnostics",
      "In-Vitro Diagnostic",
      "IVD",
    ],
    subcategories: [
      "Clinical Chemistry",
      "Hematology",
      "Immunology & Serology",
      "Molecular Diagnostics",
      "Microbiology",
      "Coagulation",
      "Urinalysis",
      "Point-of-Care Testing (POCT)",
      "Blood Gas Analysis",
      "Histopathology & Cytology",
      "Reagents & Diagnostic Kits",
      "Laboratory Automation",
    ],
  },
];

/** Find an existing top category for a menu: exact-normalized match on any
 *  alias, else a WHOLE-WORD-PREFIX fallback (handles "Critical Care" matching
 *  "Critical Care Unit"). The fallback is deliberately strict — a plain
 *  substring test wrongly matched "In-Vitro Diagnostics" to a generic
 *  "Diagnostics" category, so we require the alias (≥2 words) to be a leading
 *  whole-word prefix of the existing name, never just a substring. */
function matchTop(menu, tops) {
  const wanted = menu.aliases.map(norm);
  let top = tops.find((c) => wanted.includes(norm(c.name?.en)));
  if (top) return top;
  for (const a of wanted) {
    if (a.split(" ").length < 2) continue; // skip generic single-word aliases
    top = tops.find((c) => {
      const n = norm(c.name?.en);
      return n === a || n.startsWith(`${a} `);
    });
    if (top) return top;
  }
  return null;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const cats = db.collection("categories");

  console.log(
    `\nTarget DB: "${db.databaseName}" @ ${new URL(uri.replace("mongodb+srv://", "mongodb://")).hostname}`,
  );
  if (!hostIsLocal(uri) && !FORCE_PROD) {
    console.error(
      "\n✗ Refusing: target host is not local. Re-run with --force-prod if you really mean it.",
    );
    await client.close();
    process.exit(1);
  }

  const tops = await cats
    .find({ storefront: "instruments", parentId: null, deletedAt: null })
    .toArray();

  // All non-deleted category slugs (for global uniqueness on insert).
  const takenSlugs = new Set(
    (
      await cats
        .find({ deletedAt: null }, { projection: { slug: 1 } })
        .toArray()
    )
      .map((c) => c.slug)
      .filter(Boolean),
  );
  const uniqueSlug = (base) => {
    let s = base || "category";
    let i = 2;
    while (takenSlugs.has(s)) s = `${base}-${i++}`;
    takenSlugs.add(s);
    return s;
  };

  const now = new Date();
  let toInsertCount = 0;
  let topsToCreate = 0;
  const writes = []; // { parentName, en, slug, parentId? } resolved at write time

  for (const menu of MENUS) {
    let parent = matchTop(menu, tops);
    const menuName = menu.aliases[0];

    if (!parent) {
      if (!CREATE_MISSING) {
        console.log(
          `\n■ "${menuName}" — no existing top category matched (aliases: ${menu.aliases.join(" / ")}). SKIPPED (pass --create-missing to create it).`,
        );
        continue;
      }
      topsToCreate++;
      console.log(`\n■ "${menuName}" — will CREATE top category.`);
      // Reserve a synthetic parent marker; real insert happens in the write phase.
      parent = {
        _id: null,
        name: { en: menuName },
        slug: uniqueSlug(slugify(menuName)),
        _create: true,
      };
    } else {
      console.log(
        `\n■ "${menuName}" → matched "${parent.name?.en}" [${parent.slug}]`,
      );
    }

    const existingSubs = parent._id
      ? await cats
          .find({
            storefront: "instruments",
            parentId: parent._id,
            deletedAt: null,
          })
          .toArray()
      : [];
    const existingNorms = new Set(existingSubs.map((c) => norm(c.name?.en)));
    let nextPos = existingSubs.length
      ? Math.max(...existingSubs.map((c) => c.position ?? 0)) + 1
      : 0;

    for (const en of menu.subcategories) {
      if (existingNorms.has(norm(en))) {
        console.log(`   = exists  ${en}`);
        continue;
      }
      const slug = uniqueSlug(slugify(en));
      console.log(`   + insert  ${en}  (${slug})`);
      writes.push({ menu, parent, en, slug, position: nextPos++ });
      existingNorms.add(norm(en));
      toInsertCount++;
    }
  }

  console.log(
    `\nPlan: ${toInsertCount} subcategories to insert${topsToCreate ? `, ${topsToCreate} top categories to create` : ""}.`,
  );

  if (!COMMIT) {
    console.log("\nDRY RUN. Re-run with --commit to write.\n");
    await client.close();
    return;
  }

  // ---- Write ----
  // Resolve any to-be-created parents first, then insert subcategories.
  const createdParents = new Map();
  let lastTopPos = tops.length
    ? Math.max(...tops.map((c) => c.position ?? 0))
    : -1;
  let insertedTops = 0;
  let insertedSubs = 0;

  for (const w of writes) {
    let parentId = w.parent._id;
    if (!parentId) {
      const key = w.parent.slug;
      if (!createdParents.has(key)) {
        const { insertedId } = await cats.insertOne({
          name: { en: w.parent.name.en },
          slug: w.parent.slug,
          parentId: null,
          storefront: "instruments",
          position: ++lastTopPos,
          featured: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        createdParents.set(key, insertedId);
        insertedTops++;
        console.log(`  ✓ created top "${w.parent.name.en}" [${w.parent.slug}]`);
      }
      parentId = createdParents.get(key);
    }
    await cats.insertOne({
      name: { en: w.en },
      slug: w.slug,
      parentId,
      storefront: "instruments",
      position: w.position,
      featured: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    insertedSubs++;
  }

  console.log(
    `\n✓ Inserted ${insertedSubs} subcategories${insertedTops ? ` and ${insertedTops} top categories` : ""}. Re-running is safe (idempotent by name under each parent).\n`,
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
