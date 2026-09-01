/**
 * LOCAL QA FIXTURE — Medtrade v2 manual testing.
 *
 * Sets the local database up so every Medtrade v2 flow can be walked by hand:
 *
 *   1. A verified BUYER account (a plain customer, not an admin) so the
 *      shopper-side journey is tested as a real customer sees it. Registration
 *      alone is not enough: login requires `emailVerified`, and the dev mailer
 *      only logs to the console.
 *   2. Two PRICED instruments products with negotiation floors and stock, so
 *      the price range, a multi-item cart and stock behaviour are all testable.
 *      Price-less products are left alone — they are the "Price on request"
 *      control case.
 *   3. VAT 15% / AIT 3%, so tax lines actually appear.
 *   4. `--reset-credit` clears the buyer's credit account + applications, so the
 *      apply → approve → pay-on-terms flow can be walked again from scratch.
 *
 * SAFE BY DESIGN: refuses any non-local Mongo outright (no --force-prod escape).
 * Seeding a fake buyer into production is never the right thing to do.
 *
 * USAGE
 *   npm run qa-medtrade                       # DRY RUN — prints the plan
 *   npm run qa-medtrade -- --commit           # apply
 *   npm run qa-medtrade -- --commit --reset-credit
 *                                             # …and wipe the buyer's credit
 *                                             #   account so it can be re-tested
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
const COMMIT = argv.includes("--commit");
const RESET_CREDIT = argv.includes("--reset-credit");

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
if (!hostIsLocal(uri)) {
  console.error(
    "Refusing to run: this is a LOCAL QA fixture and the Mongo host is not local.",
  );
  process.exit(1);
}

/** The buyer used for all shopper-side manual testing. */
const BUYER = {
  name: "Rahim Uddin (QA Buyer)",
  email: "buyer@spibermed.test",
  password: "QaBuyer!2026",
};

/** Products to price so the range + cart flows are testable. */
const PRICED = [
  {
    slug: "disposable-syringe-5ml",
    priceMinor: 50_000,
    floorPriceMinor: 42_000,
    stockQty: 40,
  },
  {
    slug: "n95-respirator",
    priceMinor: 12_000,
    floorPriceMinor: 9_500,
    stockQty: 60,
  },
];

async function main() {
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;

  console.log(`\nDB: ${dbName} @ ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log(COMMIT ? "MODE: COMMIT (writing)\n" : "MODE: DRY RUN\n");

  const users = db.collection("users");
  const products = db.collection("products");
  const settings = db.collection("settings");

  const existingBuyer = await users.findOne({ email: BUYER.email });
  console.log("Plan:");
  console.log(
    `  buyer ${BUYER.email} — ${existingBuyer ? "reset password + verify" : "CREATE"}`,
  );
  for (const p of PRICED) {
    const doc = await products.findOne({ slug: p.slug, deletedAt: null });
    console.log(
      doc
        ? `  price ${p.slug} → ৳${p.priceMinor / 100} (floor ৳${p.floorPriceMinor / 100}), stock ${p.stockQty}`
        : `  ⚠ product ${p.slug} NOT FOUND — skipped`,
    );
  }
  console.log("  settings medtradeCommerce → VAT 15%, AIT 3%");
  if (RESET_CREDIT) {
    console.log("  reset the buyer's credit account + applications");
  } else {
    console.log("  credit: untouched (pass --reset-credit to clear it)");
  }

  if (!COMMIT) {
    console.log("\nDry run — nothing written. Re-run with --commit.\n");
    await mongoose.disconnect();
    return;
  }

  // --- buyer ---
  const passwordHash = await bcrypt.hash(BUYER.password, 12);
  await users.updateOne(
    { email: BUYER.email },
    {
      $set: {
        name: BUYER.name,
        passwordHash,
        // Login is gated on this and the dev mailer only logs to the console.
        emailVerified: true,
        disabled: false,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        email: BUYER.email,
        roles: ["customer"],
        locale: "en",
        tokenVersion: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  const buyer = await users.findOne({ email: BUYER.email });
  console.log(`  buyer ready: ${BUYER.email} / ${BUYER.password}`);

  // --- priced products ---
  for (const p of PRICED) {
    const res = await products.updateOne(
      { slug: p.slug, deletedAt: null },
      {
        $set: {
          priceMinor: p.priceMinor,
          floorPriceMinor: p.floorPriceMinor,
          stockQty: p.stockQty,
          status: "active",
          updatedAt: new Date(),
        },
      },
    );
    if (res.matchedCount === 0) console.log(`  ⚠ ${p.slug} not found`);
    else console.log(`  priced ${p.slug}`);
  }

  // --- tax settings ---
  await settings.updateOne(
    { key: "medtradeCommerce" },
    {
      $set: {
        value: { vatRateBp: 1500, aitRateBp: 300 },
        updatedAt: new Date(),
      },
      $setOnInsert: { key: "medtradeCommerce", createdAt: new Date() },
    },
    { upsert: true },
  );
  console.log("  settings: VAT 15% / AIT 3%");

  // --- credit reset ---
  if (RESET_CREDIT && buyer) {
    const a = await db
      .collection("credit_accounts")
      .deleteMany({ userId: buyer._id });
    const b = await db
      .collection("credit_applications")
      .deleteMany({ userId: buyer._id });
    console.log(
      `  credit reset: removed ${a.deletedCount} account(s), ${b.deletedCount} application(s)`,
    );
  }

  console.log("\nDone. Buyer login:");
  console.log(`  ${BUYER.email}`);
  console.log(`  ${BUYER.password}\n`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
