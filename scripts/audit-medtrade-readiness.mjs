/**
 * READ-ONLY post-deploy audit for Medtrade v2. Writes nothing, ever.
 *
 * Answers the question "what did the deploy actually change for my catalogue?"
 *
 * The one thing worth knowing: a Medtrade product becomes BUYABLE the moment it
 * has a price. There is no separate publish-to-shop flag. So a product that is
 * active + priced + in stock is purchasable right now, and if VAT is still 0 it
 * will be sold without VAT. Everything price-less stays quotation-only exactly
 * as before, which is how the 277 imported products landed.
 *
 * USAGE
 *   npm run audit-medtrade                       # uses MONGODB_URI / .env.local
 *   MONGODB_URI="mongodb://…prod…" npm run audit-medtrade
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

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spiber";
if (!uri) {
  console.error("MONGODB_URI is not set (checked env and .env.local).");
  process.exit(1);
}

const money = (minor) =>
  minor == null ? "—" : `BDT ${(minor / 100).toLocaleString("en-US")}`;

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const products = db.collection("products");
  const carts = db.collection("carts");

  console.log(`\nDB: ${dbName} @ ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log("MODE: READ-ONLY — this script writes nothing.\n");

  // ---- 1. Catalogue -------------------------------------------------------
  const base = { storefront: "instruments", deletedAt: null };
  const priced = { ...base, priceMinor: { $ne: null } };

  const total = await products.countDocuments(base);
  const active = await products.countDocuments({ ...base, status: "active" });
  const pricedCount = await products.countDocuments(priced);
  const buyable = await products.countDocuments({
    ...priced,
    status: "active",
  });
  const purchasable = await products.countDocuments({
    ...priced,
    status: "active",
    stockQty: { $gt: 0 },
  });
  const withFloor = await products.countDocuments({
    ...base,
    floorPriceMinor: { $ne: null },
  });

  console.log("MEDTRADE CATALOGUE");
  console.log(`  products (not deleted)        ${total}`);
  console.log(`  …active                       ${active}`);
  console.log(`  …with a price                 ${pricedCount}`);
  console.log(`  …with a negotiation floor     ${withFloor}`);
  console.log(`  BUYABLE (active + priced)     ${buyable}`);
  console.log(`  PURCHASABLE (…+ in stock)     ${purchasable}`);
  console.log(`  quotation-only (no price)     ${total - pricedCount}`);

  if (purchasable > 0) {
    console.log("\n  Purchasable right now:");
    const rows = await products
      .find(
        { ...priced, status: "active", stockQty: { $gt: 0 } },
        {
          projection: {
            slug: 1,
            priceMinor: 1,
            floorPriceMinor: 1,
            stockQty: 1,
          },
        },
      )
      .limit(25)
      .toArray();
    for (const r of rows) {
      const floor =
        r.floorPriceMinor != null ? ` (floor ${money(r.floorPriceMinor)})` : "";
      console.log(
        `    - ${r.slug}: ${money(r.priceMinor)}${floor}, stock ${r.stockQty}`,
      );
    }
    if (purchasable > rows.length) {
      console.log(`    …and ${purchasable - rows.length} more`);
    }
  }

  // ---- 2. Tax -------------------------------------------------------------
  const commerce = await db
    .collection("settings")
    .findOne({ key: "medtradeCommerce" });
  const vat = commerce?.value?.vatRateBp ?? 0;
  const ait = commerce?.value?.aitRateBp ?? 0;

  console.log("\nTAX");
  console.log(
    `  VAT  ${vat / 100}%  ${vat === 0 ? "← OFF, nothing charged" : ""}`,
  );
  console.log(
    `  AIT  ${ait / 100}%  ${ait === 0 ? "← OFF, no invoice note" : "(invoice note only)"}`,
  );

  // ---- 3. Cart migration --------------------------------------------------
  const indexes = await carts.indexes();
  const stale = ["userId_1", "guestId_1"].filter((n) =>
    indexes.some((ix) => ix.name === n),
  );
  const compound = ["userId_1_storefront_1", "guestId_1_storefront_1"].filter(
    (n) => indexes.some((ix) => ix.name === n),
  );

  console.log("\nCART MIGRATION");
  console.log(
    `  carts in collection           ${await carts.countDocuments({})}`,
  );
  console.log(`  new compound indexes          ${compound.length}/2 present`);
  console.log(
    stale.length
      ? `  STALE INDEXES STILL PRESENT   ${stale.join(", ")}`
      : "  stale indexes                 dropped ✓",
  );

  // ---- 4. Verdict ---------------------------------------------------------
  console.log("\nVERDICT");
  const problems = [];
  if (stale.length) {
    problems.push(
      "Run: node scripts/migrate-cart-storefront.mjs --commit --force-prod\n" +
        "     Until then, a shopper who already has a Spiber Kart cart gets a\n" +
        "     duplicate-key error the moment they add a Medtrade item.",
    );
  }
  if (buyable > 0 && vat === 0) {
    problems.push(
      `${buyable} product(s) can be bought right now and VAT is 0%, so those\n` +
        "     orders would be placed with no VAT. Either set the VAT rate at\n" +
        "     /admin/settings, or clear those prices to keep them quotation-only.",
    );
  }
  if (buyable > 0 && vat > 0) {
    console.log(
      `  ${buyable} product(s) are now buyable at ${vat / 100}% VAT. Confirm that is intended.`,
    );
  }
  if (problems.length === 0 && buyable === 0) {
    console.log(
      "  Nothing to do. Every Medtrade product is price-less, so the catalogue\n" +
        "  behaves exactly as it did before the deploy: quotation-only.",
    );
  }
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

  console.log("");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
