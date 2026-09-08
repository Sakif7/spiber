/**
 * DESTRUCTIVE wipe of operational data, for starting a test run from scratch.
 *
 *   npm run wipe-data                       (dry run — prints what WOULD go)
 *   npm run wipe-data -- --confirm          (local DB)
 *   npm run wipe-data -- --confirm --force-prod   (remote/prod DB)
 *
 * Clears the things a person creates while USING the app — catalogue, stock,
 * people, leads, orders and vault files — and leaves the things that define it:
 * user accounts, categories, brands, settings, blog and tourism content.
 *
 * The in-app Data cleanup tab covers the storefront collections but predates
 * the Company section, so employees, leads, sales orders, visits, expenses and
 * the document vault cannot be cleared from the UI at all. This fills that gap.
 *
 * Guards, mirroring reset-and-seed:
 *  - dry run unless --confirm,
 *  - refuses a non-local Mongo host without --force-prod,
 *  - never touches `users`, so you stay signed in.
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
const CONFIRM = argv.includes("--confirm");
const FORCE_PROD = argv.includes("--force-prod");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spiber";
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const isLocal = /(localhost|127\.0\.0\.1)/.test(uri);
if (!isLocal && !FORCE_PROD) {
  console.error(
    "Refusing to run against a non-local Mongo host without --force-prod.",
  );
  process.exit(1);
}

/** Everything a person creates by using the app. */
const COLLECTIONS = [
  // Catalogue and stock
  "products",
  "inventory_movements",
  // Storefront activity
  "orders",
  "carts",
  "quote_lists",
  "quotation_requests",
  "reviews",
  "wishlist_items",
  // Company — sales
  "sales_leads",
  "sales_orders",
  // Company — people
  "employees",
  "visits",
  "expenses",
  "payroll_runs",
  // Company — the document vault
  "company_documents",
  "company_folders",
  // Seller money that hangs off orders
  "seller_commissions",
  "seller_payouts",
];

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

console.log(`${CONFIRM ? "WIPING" : "DRY RUN"} — ${dbName} @ ${uri}\n`);

let total = 0;
for (const name of COLLECTIONS) {
  const count = await db.collection(name).countDocuments();
  total += count;
  if (!count) {
    console.log(`  ${String(0).padStart(5)}  ${name}`);
    continue;
  }
  if (CONFIRM) {
    const res = await db.collection(name).deleteMany({});
    console.log(`  ${String(res.deletedCount).padStart(5)}  ${name}  deleted`);
  } else {
    console.log(`  ${String(count).padStart(5)}  ${name}  would be deleted`);
  }
}

const users = await db.collection("users").countDocuments();
console.log(`\n${total} document(s) in scope. ${users} user account(s) kept.`);
if (!CONFIRM) console.log("Nothing was changed. Re-run with --confirm.");

await client.close();
