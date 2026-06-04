/**
 * One-time index migration for the 2026-06-04 hardening pass.
 *
 *   npm run sync-indexes
 *
 * The slug/SKU uniqueness moved from plain-unique to soft-delete-aware
 * PARTIAL-unique, and new partial-unique guards were added for live enrollments
 * and software purchases. Mongoose's auto-index CREATES new indexes but never
 * DROPS the old ones — and an old index with the same name (e.g. `slug_1`)
 * blocks the new partial one from building. This script drops the stale indexes
 * and (re)creates the correct ones. It only touches INDEXES, never documents.
 *
 * Safe to run repeatedly. Run it against whichever DB you want to migrate by
 * pointing MONGODB_URI at it (defaults to .env.local). Fresh/empty DBs are fine.
 *
 * Reads MONGODB_URI / MONGODB_DB from the environment, falling back to .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

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

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (checked env and .env.local).");
  process.exit(1);
}

const livePartial = (statuses) => ({ status: { $in: statuses } });

/**
 * Per collection: stale index NAMES to drop, then the desired indexes to create.
 * Index names follow Mongoose's default `<field>_<dir>` convention.
 */
const PLAN = [
  {
    coll: "products",
    drop: ["slug_1", "sku_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
      {
        keys: { sku: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "courses",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "software_products",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "brands",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "categories",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "blog_posts",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "blog_categories",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    coll: "blog_tags",
    drop: ["slug_1"],
    create: [
      {
        keys: { slug: 1 },
        opts: { unique: true, partialFilterExpression: { deletedAt: null } },
      },
    ],
  },
  {
    // old `userId_1_courseId_1` was NON-unique → same name, must drop first.
    coll: "enrollments",
    drop: ["userId_1_courseId_1"],
    create: [
      {
        keys: { userId: 1, courseId: 1 },
        opts: {
          unique: true,
          partialFilterExpression: livePartial(["pending", "active"]),
        },
      },
      {
        keys: { certificateId: 1 },
        opts: {
          unique: true,
          partialFilterExpression: { certificateId: { $type: "string" } },
        },
      },
    ],
  },
  {
    // brand-new 2-key partial-unique (old 3-key index has a different name).
    coll: "software_purchases",
    drop: [],
    create: [
      {
        keys: { userId: 1, softwareProductId: 1 },
        opts: {
          unique: true,
          partialFilterExpression: livePartial(["pending", "paid"]),
        },
      },
    ],
  },
  {
    coll: "audit_logs",
    drop: [],
    create: [
      { keys: { createdAt: -1 }, opts: {} },
      { keys: { entityType: 1, entityId: 1, createdAt: -1 }, opts: {} },
    ],
  },
];

async function main() {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "spiber" });
  const db = mongoose.connection.db;
  console.log(`\nSyncing indexes on "${db.databaseName}"…\n`);

  for (const { coll, drop, create } of PLAN) {
    const c = db.collection(coll);
    for (const name of drop) {
      try {
        await c.dropIndex(name);
        console.log(`  ${coll}: dropped stale index ${name}`);
      } catch (e) {
        // 27 = IndexNotFound, 26 = NamespaceNotFound (fresh DB) — both fine.
        if (e.code === 27 || e.code === 26) continue;
        console.warn(
          `  ${coll}: could not drop ${name} (${e.codeName ?? e.message})`,
        );
      }
    }
    for (const { keys, opts } of create) {
      try {
        const name = await c.createIndex(keys, opts);
        console.log(`  ${coll}: ensured index ${name}`);
      } catch (e) {
        console.warn(
          `  ${coll}: could not create ${JSON.stringify(keys)} (${e.codeName ?? e.message})`,
        );
      }
    }
  }

  console.log("\n✓ Index sync complete.\n");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
