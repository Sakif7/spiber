/**
 * Seed the ZenHcare software product into the Digihealth catalog.
 *
 *   npm run seed-zenhcare               (dry run — prints what WOULD change)
 *   node scripts/seed-zenhcare-product.mjs --commit             (local DB)
 *   node scripts/seed-zenhcare-product.mjs --commit --force-prod   (remote/prod)
 *
 * ZenHcare is a partner platform Spiber refers customers to (Spiber is a
 * ZenHcare affiliate). It is modeled as a QUOTE product with NO price:
 *   pricingModel "quote"  -> detail page shows "Custom quote", hides any amount
 *   deliveryType "external" + externalApp "zenhcare" -> a request-access inquiry
 *     is forwarded to ZenHcare's affiliate sales API (see lib/services/inquiry.service.ts)
 *
 * Idempotent: upserts by slug "zenhcare". Re-running refreshes copy without
 * duplicating. Raw driver — Mongoose defaults/timestamps do NOT apply, so every
 * field (createdAt/updatedAt/screenshots/features/deletedAt) is set explicitly.
 *
 * Guards mirror reset-and-seed.mjs: dry run unless --commit; refuses a non-local
 * Mongo host unless --force-prod. (PowerShell drops `npm run x -- --flag`; call
 * node directly when passing flags.)
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
const COMMIT = argv.includes("--commit");
const FORCE_PROD = argv.includes("--force-prod");

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

if (!hostIsLocal(uri) && !FORCE_PROD) {
  console.error(
    "Refusing to run against a non-local Mongo host without --force-prod.",
  );
  process.exit(1);
}

// The ZenHcare product document. deletedAt:null is set explicitly so the
// partial-unique slug index applies and the repo (which filters deletedAt:null)
// finds it. priceMinor is intentionally OMITTED (quote product, no price shown).
const SET_FIELDS = {
  name: { en: "ZenHcare", bn: "জেনএইচকেয়ার", ja: "ZenHcare" },
  description: {
    en: "Complete hospital, clinic and chamber management — OPD, IPD, pharmacy, lab, billing and telemedicine in one cloud platform. Spiber Med is an official ZenHcare partner; request access and our team arranges your demo and onboarding.",
    bn: "ওপিডি, আইপিডি, ফার্মেসি, ল্যাব, বিলিং ও টেলিমেডিসিন — এক ক্লাউড প্ল্যাটফর্মে হাসপাতাল, ক্লিনিক ও চেম্বারের সম্পূর্ণ ব্যবস্থাপনা। স্পাইবার মেড জেনএইচকেয়ারের অফিসিয়াল পার্টনার; অ্যাক্সেসের অনুরোধ করুন, আমরা ডেমো ও অনবোর্ডিং সাজিয়ে দেব।",
  },
  features: [
    {
      en: "OPD & appointments",
      bn: "ওপিডি ও অ্যাপয়েন্টমেন্ট",
      ja: "外来・予約管理",
    },
    {
      en: "IPD & bed management",
      bn: "আইপিডি ও বেড ম্যানেজমেন্ট",
      ja: "入院・ベッド管理",
    },
    {
      en: "Pharmacy & inventory",
      bn: "ফার্মেসি ও ইনভেন্টরি",
      ja: "薬局・在庫管理",
    },
    { en: "Lab & diagnostics", bn: "ল্যাব ও ডায়াগনস্টিকস", ja: "検査・診断" },
    { en: "Billing & finance", bn: "বিলিং ও ফাইন্যান্স", ja: "請求・会計" },
    { en: "Telemedicine", bn: "টেলিমেডিসিন", ja: "遠隔診療" },
  ],
  screenshots: [],
  pricingModel: "quote",
  deliveryType: "external",
  externalApp: "zenhcare",
  categoryId: null,
  status: "active",
  updatedAt: new Date(),
};

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const col = client.db(dbName).collection("software_products");
    const existing = await col.findOne({ slug: "zenhcare" });

    console.log(
      `Target: ${dbName}.software_products  host=${new URL(uri.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname}`,
    );
    console.log(
      existing
        ? `Found existing "zenhcare" (status=${existing.status}, deletedAt=${existing.deletedAt}) — will refresh copy/status.`
        : `No existing "zenhcare" product — will insert a new one.`,
    );

    if (!COMMIT) {
      console.log("\nDRY RUN (no write). Re-run with --commit to apply.");
      return;
    }

    const res = await col.updateOne(
      { slug: "zenhcare" },
      {
        $set: SET_FIELDS,
        $setOnInsert: {
          slug: "zenhcare",
          createdAt: new Date(),
          deletedAt: null,
        },
      },
      { upsert: true },
    );

    if (res.upsertedCount) {
      console.log(`\n✅ Inserted ZenHcare product (_id ${res.upsertedId}).`);
    } else {
      console.log(
        `\n✅ Updated existing ZenHcare product (matched ${res.matchedCount}).`,
      );
    }
    console.log(
      "   Visible at /digihealth and /digihealth/product/zenhcare (status active).",
    );
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
