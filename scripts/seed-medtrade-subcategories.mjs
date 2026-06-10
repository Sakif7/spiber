/**
 * Seed Medtrade (instruments) SUBCATEGORIES under the existing top-level parent
 * "Medical & Surgical Disposable".
 *
 * WHY / SMOOTH TRANSITION
 *   The parent already exists in the production DB and already has products
 *   filed directly on it. This script ONLY inserts the 8 subcategories — it
 *   NEVER touches products. Existing products stay attached to the parent and
 *   keep showing everywhere, because the Medtrade category page resolves the
 *   whole subtree (categoryWithDescendantIds): the parent page lists products on
 *   the parent AND on any subcategory. You then reassign products into the right
 *   subcategory at your own pace from the admin product editor — nothing breaks
 *   in the meantime. The header nav drawer starts showing the subcategories as
 *   soon as they exist.
 *
 * IDEMPOTENT
 *   Subcategories are found-or-created by slug, so re-running never duplicates
 *   and never clobbers anything an admin renamed/reordered. Only missing ones
 *   are inserted (appended after the last existing subcategory).
 *
 * USAGE
 *   npm run seed-medtrade-subs                          # DRY RUN — report only, no writes
 *   npm run seed-medtrade-subs -- --commit              # write to local Mongo
 *   npm run seed-medtrade-subs -- --commit --force-prod # write to a NON-local Mongo
 *   npm run seed-medtrade-subs -- --commit --create-parent  # create the parent if it's missing
 *   npm run seed-medtrade-subs -- --parent "Some Other Name"  # match a differently-named parent
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
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const COMMIT = has("--commit");
const FORCE_PROD = has("--force-prod");
const CREATE_PARENT = has("--create-parent");
const PARENT_NAME = valueOf("--parent") || "Medical & Surgical Disposable";

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

// Compare names ignoring case, "&"/"and", and punctuation/spacing so the parent
// is matched robustly however it was originally typed.
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

// The 8 subcategories from the client's "OUR PRODUCT RANGE" sheet (English;
// Bangla falls back to English, matching the existing marketplace seed).
const SUBCATEGORIES = [
  "Injection & Infusion Products",
  "Surgical Gloves & PPE",
  "Wound Care & Dressing Materials",
  "Urology Consumables",
  "Operating Theatre Consumables",
  "Sutures",
  "Anesthesia & Airway Products",
  "Diagnostic & Sampling Consumables",
];

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

  // ---- Locate the parent ----
  const tops = await cats
    .find({ storefront: "instruments", parentId: null, deletedAt: null })
    .toArray();
  const wanted = norm(PARENT_NAME);
  let parent = tops.find((c) => norm(c.name?.en) === wanted);

  if (!parent) {
    console.log(
      `\nParent "${PARENT_NAME}" (normalized: "${wanted}") not found among instruments top categories:`,
    );
    for (const c of tops) console.log(`  - "${c.name?.en}" [${c.slug}]`);
    if (!CREATE_PARENT) {
      console.log(
        "\nNo matching parent. Re-run with --create-parent to create it, or pass --parent <name> to match an existing one.",
      );
      await client.close();
      process.exit(1);
    }
    if (!COMMIT) {
      console.log(
        `\nDRY RUN: would CREATE parent "${PARENT_NAME}" + ${SUBCATEGORIES.length} subcategories. Re-run with --commit.`,
      );
      await client.close();
      process.exit(1);
    }
    const now = new Date();
    const lastTop = tops.length
      ? Math.max(...tops.map((c) => c.position ?? 0))
      : -1;
    const { insertedId } = await cats.insertOne({
      name: { en: PARENT_NAME },
      slug: slugify(PARENT_NAME),
      parentId: null,
      storefront: "instruments",
      position: lastTop + 1,
      featured: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    parent = await cats.findOne({ _id: insertedId });
    console.log(`  ✓ created parent "${PARENT_NAME}" [${parent.slug}]`);
  } else {
    console.log(
      `\nParent: "${parent.name?.en}" [${parent.slug}] (${parent._id})`,
    );
  }

  // ---- Plan the subcategories (find-or-create by slug) ----
  const existingSubs = await cats
    .find({ storefront: "instruments", parentId: parent._id, deletedAt: null })
    .toArray();
  const existingBySlug = new Map(existingSubs.map((c) => [c.slug, c]));
  let nextPos = existingSubs.length
    ? Math.max(...existingSubs.map((c) => c.position ?? 0)) + 1
    : 0;

  const plan = SUBCATEGORIES.map((en) => {
    const slug = slugify(en);
    const existing = existingBySlug.get(slug);
    return { en, slug, action: existing ? "exists" : "insert" };
  });

  console.log("\nSubcategory plan:");
  for (const p of plan)
    console.log(
      `  [${p.action === "insert" ? "+ insert" : "= exists "}] ${p.en}  (${p.slug})`,
    );
  const toInsert = plan.filter((p) => p.action === "insert");
  console.log(
    `\n${toInsert.length} to insert, ${plan.length - toInsert.length} already present.`,
  );

  if (!COMMIT) {
    console.log("\nDRY RUN. Re-run with --commit to write.\n");
    await client.close();
    process.exit(toInsert.length ? 0 : 0);
  }

  // ---- Write ----
  const now = new Date();
  let inserted = 0;
  for (const p of toInsert) {
    await cats.insertOne({
      name: { en: p.en },
      slug: p.slug,
      parentId: parent._id,
      storefront: "instruments",
      position: nextPos++,
      featured: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    inserted++;
  }

  const total = await cats.countDocuments({
    storefront: "instruments",
    parentId: parent._id,
    deletedAt: null,
  });
  console.log(
    `\n✓ Inserted ${inserted} subcategories. "${parent.name?.en}" now has ${total} subcategories.`,
  );
  console.log(
    "  Existing products stay on the parent and remain visible (the category page resolves the whole subtree). Reassign them to subcategories from the admin product editor.\n",
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
