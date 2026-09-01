/**
 * ONE-TIME MIGRATION — carts became storefront-scoped (Medtrade v2, Phase 3).
 *
 * WHY
 *   A cart used to be unique per owner: `userId_1` and `guestId_1` unique
 *   indexes, one cart per person, full stop. Medtrade now has its own cart
 *   alongside Spiber Kart, so uniqueness moved to (owner, storefront) via new
 *   COMPOUND indexes.
 *
 *   Mongoose creates the new compound indexes on its own, but it NEVER drops the
 *   old ones. While `userId_1` / `guestId_1` still exist, a shopper who has a
 *   Kart cart gets a duplicate-key error the moment they add a Medtrade item.
 *   This script drops exactly those two stale indexes.
 *
 * BACK-FILL (optional, --backfill)
 *   Legacy carts have no `storefront` field. They read correctly either way —
 *   marketplace queries match them with `{ $in: ["marketplace", null] }`, and
 *   `getOrCreateCart` stamps the field on first write — so the back-fill is a
 *   tidy-up, not a correctness requirement. It is off by default.
 *
 * SAFE TO RE-RUN
 *   Dropping an already-absent index is treated as a no-op, and the back-fill
 *   only touches documents that still lack the field.
 *
 * USAGE
 *   node scripts/migrate-cart-storefront.mjs                            # DRY RUN — report only
 *   node scripts/migrate-cart-storefront.mjs --commit                   # apply to local Mongo
 *   node scripts/migrate-cart-storefront.mjs --commit --backfill        # also stamp legacy carts
 *   node scripts/migrate-cart-storefront.mjs --commit --force-prod      # apply to a NON-local Mongo
 *
 * Guards (mirror the other scripts):
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
const BACKFILL = has("--backfill");

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

if (COMMIT && !hostIsLocal(uri) && !FORCE_PROD) {
  console.error(
    "Refusing to write to a non-local Mongo host without --force-prod.",
  );
  process.exit(1);
}

/** The stale single-field unique indexes this migration removes. */
const STALE_INDEXES = ["userId_1", "guestId_1"];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const carts = db.collection("carts");

  console.log(`\nDB: ${dbName} @ ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log(COMMIT ? "MODE: COMMIT (writing)\n" : "MODE: DRY RUN\n");

  const indexes = await carts.indexes();
  console.log("Current indexes on `carts`:");
  for (const ix of indexes) {
    console.log(
      `  - ${ix.name}  keys=${JSON.stringify(ix.key)}${ix.unique ? "  UNIQUE" : ""}`,
    );
  }

  const present = STALE_INDEXES.filter((n) =>
    indexes.some((ix) => ix.name === n),
  );
  const totalCarts = await carts.countDocuments({});
  const legacyCarts = await carts.countDocuments({
    storefront: { $exists: false },
  });

  console.log(`\nPlan:`);
  console.log(
    present.length
      ? `  drop stale unique indexes: ${present.join(", ")}`
      : `  drop stale unique indexes: none present (already migrated)`,
  );
  console.log(
    BACKFILL
      ? `  back-fill storefront="marketplace" on ${legacyCarts} legacy cart(s)`
      : `  back-fill: skipped (pass --backfill to stamp ${legacyCarts} legacy cart(s))`,
  );
  console.log(`  carts in collection: ${totalCarts}`);

  if (!COMMIT) {
    console.log("\nDry run — nothing written. Re-run with --commit.\n");
    await client.close();
    return;
  }

  for (const name of present) {
    try {
      await carts.dropIndex(name);
      console.log(`  dropped ${name}`);
    } catch (err) {
      // IndexNotFound (27) — someone else already dropped it. Not an error.
      if (err?.code === 27) console.log(`  ${name} already absent`);
      else throw err;
    }
  }

  if (BACKFILL && legacyCarts > 0) {
    const res = await carts.updateMany(
      { storefront: { $exists: false } },
      { $set: { storefront: "marketplace" } },
    );
    console.log(`  back-filled ${res.modifiedCount} cart(s)`);
  }

  console.log(
    "\nDone. The new compound indexes ({userId,storefront} / {guestId,storefront})",
  );
  console.log("are created automatically by Mongoose on next app start.\n");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
