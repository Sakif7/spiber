/**
 * Seed the Spiber Tourism BLOG CATEGORIES (per the brief): Health Education,
 * Medical Tourism, Surgery Guides, Travel Health, Digital Health, Patient
 * Stories.
 *
 * IDEMPOTENT
 *   Each category is upserted BY SLUG with `$setOnInsert`, so re-running never
 *   duplicates and never clobbers a name/description an admin edited. Only
 *   missing categories are inserted. (Not delete-then-insert — that would
 *   orphan posts already filed under a category.)
 *
 * USAGE
 *   npm run seed-tourism-blog-cats                        # DRY RUN — report only
 *   npm run seed-tourism-blog-cats -- --commit            # write to local Mongo
 *   npm run seed-tourism-blog-cats -- --commit --force-prod  # write to a NON-local Mongo
 *
 * Guards mirror the other seed scripts (refuses without --commit; refuses a
 * non-local host without --force-prod). Reads MONGODB_URI / MONGODB_DB from env,
 * falling back to .env.local. Bangla falls back to English where not provided,
 * matching the existing marketplace/medtrade seeds.
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

// English name + Bangla (per the brief).
const CATEGORIES = [
  { en: "Health Education", bn: "স্বাস্থ্য শিক্ষা" },
  { en: "Medical Tourism", bn: "মেডিকেল ট্যুরিজম" },
  { en: "Surgery Guides", bn: "সার্জারি গাইড" },
  { en: "Travel Health", bn: "ভ্রমণ স্বাস্থ্য" },
  { en: "Digital Health", bn: "ডিজিটাল হেলথ" },
  { en: "Patient Stories", bn: "রোগীর গল্প" },
];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection("blog_categories");

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

  const planned = CATEGORIES.map((c) => ({ ...c, slug: slugify(c.en) }));
  const existing = await col
    .find({ slug: { $in: planned.map((c) => c.slug) } })
    .toArray();
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const toInsert = planned.filter((c) => !existingSlugs.has(c.slug));

  console.log(`\nCategories: ${planned.length} total`);
  for (const c of planned) {
    console.log(
      `  ${existingSlugs.has(c.slug) ? "· exists" : "+ create"}  ${c.en} [${c.slug}]`,
    );
  }

  if (!COMMIT) {
    console.log(
      `\nDRY RUN: would insert ${toInsert.length} new categor${toInsert.length === 1 ? "y" : "ies"}. Re-run with --commit to write.`,
    );
    await client.close();
    return;
  }

  const now = new Date();
  let inserted = 0;
  for (const c of planned) {
    const res = await col.updateOne(
      { slug: c.slug },
      {
        $setOnInsert: {
          name: { en: c.en, bn: c.bn },
          slug: c.slug,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) inserted += 1;
  }

  console.log(
    `\n✓ Done. Inserted ${inserted}; ${planned.length - inserted} already present.`,
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
