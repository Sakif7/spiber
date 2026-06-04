/**
 * DESTRUCTIVE reset + fresh seed.
 *
 *   npm run reset-seed -- --confirm            (local DB)
 *   npm run reset-seed -- --confirm --force-prod   (remote/prod DB)
 *
 * Wipes EVERY collection EXCEPT admin/super_admin user accounts, then seeds the
 * Marketplace category tree (+ corporate testimonials/news so the homepage still
 * renders). No products are seeded — empty catalogs show a "Coming soon" state.
 *
 * Guards:
 *  - refuses to run without --confirm (prints what WOULD be deleted, then exits),
 *  - refuses against a non-local Mongo host without --force-prod.
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
const CONFIRM = argv.includes("--confirm");
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

const ADMIN_ROLES = ["admin", "super_admin"];
const PROTECT_USERS_FILTER = { roles: { $nin: ADMIN_ROLES } };

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Marketplace category tree (no "Spiber" prefix). bn on top level; subs en-only.
const TREE = [
  {
    en: "Medical",
    bn: "মেডিকেল",
    icon: "stethoscope",
    children: [
      "Medical Equipment",
      "Diagnostics",
      "Hospital Supplies",
      "Home Healthcare",
    ],
  },
  {
    en: "Health & Wellness",
    bn: "স্বাস্থ্য ও সুস্থতা",
    icon: "heart-pulse",
    children: ["Supplements", "Personal Care", "Beauty", "Fitness"],
  },
  {
    en: "Technology",
    bn: "প্রযুক্তি",
    icon: "cpu",
    children: ["Consumer Electronics", "Mobile Accessories", "Smart Devices"],
  },
  {
    en: "Home & Living",
    bn: "হোম ও লিভিং",
    icon: "sofa",
    children: ["Appliances", "Kitchen", "Furniture"],
  },
  { en: "Mother & Baby", bn: "মা ও শিশু", icon: "baby", children: [] },
  {
    en: "Automobile Accessories",
    bn: "অটোমোবাইল এক্সেসরিজ",
    icon: "car",
    children: [],
  },
  {
    en: "Agriculture & Local",
    bn: "কৃষি ও স্থানীয়",
    icon: "wheat",
    children: [],
  },
  {
    en: "Books & Education",
    bn: "বই ও শিক্ষা",
    icon: "book-open",
    children: [],
  },
  {
    en: "Global (Imported)",
    bn: "গ্লোবাল (আমদানি)",
    icon: "globe",
    children: [],
  },
];

const testimonials = [
  {
    order: 1,
    tone: "teal",
    name: "Prof. Dr. Md. Moazzem Hossain",
    role: "Chairman · Aichi Healthcare Group",
    quote:
      "I have had the pleasure of working with SPIBER MED for all our medical equipment needs, and I can confidently say they are one of the best in the industry. Their commitment to quality, reliability, and customer satisfaction is unmatched.",
  },
  {
    order: 2,
    tone: "orange",
    name: "Arpit Ahuja",
    role: "Founder & Director · TOP MRI & Medicto",
    quote:
      "A remarkable partner that has earned my confidence in just a few months. Their proactive approach to addressing our needs has been impressive — they understood our requirements from the outset and consistently exceeded expectations.",
  },
  {
    order: 3,
    tone: "slate",
    name: "Dr. Sumaiya Khan",
    role: "Director · Greenlife Specialty Hospital",
    quote:
      "End-to-end delivery on a scale I haven't seen elsewhere in the region. From feasibility study through commissioning and training, the team kept us on schedule and on budget.",
  },
];

const posts = [
  {
    kicker: "INDUSTRY",
    title: "Healthcare industry management — the operator's lens",
    excerpt:
      "A long-form look at how Bangladesh's hospital operators are modernizing — and the structural reforms that need to follow.",
    date: "25 NOV 2025",
    read: "8 min",
    tone: "teal",
    placeholder: "industry feature photo",
  },
  {
    kicker: "WORKFORCE",
    title: "Global employability for healthcare professionals",
    excerpt:
      "How our overseas placement pathways are connecting Bangladeshi clinicians with hospitals in Japan, Germany, and the UK.",
    date: "18 NOV 2025",
    read: "6 min",
    tone: "orange",
    placeholder: "workforce photo",
  },
  {
    kicker: "FIELD NOTES",
    title: "Lessons from the COVID-19 response, five years on",
    excerpt:
      "What worked, what didn't, and what every hospital can carry forward into the next public-health emergency.",
    date: "01 NOV 2025",
    read: "10 min",
    tone: "slate",
    placeholder: "field photo",
  },
];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."));

  // Report what will be cleared.
  console.log(
    `\nTarget DB: "${db.databaseName}" @ ${new URL(uri.replace("mongodb+srv://", "mongodb://")).hostname}`,
  );
  const protectedAdmins = collections.includes("users")
    ? await db
        .collection("users")
        .countDocuments({ roles: { $in: ADMIN_ROLES } })
    : 0;
  console.log(`Protected admin/super_admin users: ${protectedAdmins}\n`);
  console.log("Collections to clear:");
  for (const name of collections) {
    const count = await db.collection(name).countDocuments();
    const note = name === "users" ? " (keeps admin/super_admin)" : "";
    console.log(`  - ${name}: ${count} docs${note}`);
  }

  if (!hostIsLocal(uri) && !FORCE_PROD) {
    console.error(
      "\n✗ Refusing: target host is not local. Re-run with --force-prod if you really mean it.",
    );
    await client.close();
    process.exit(1);
  }
  if (!CONFIRM) {
    console.log("\nDry run. Re-run with --confirm to actually wipe + seed.\n");
    await client.close();
    process.exit(1);
  }

  console.log("\nClearing…");
  for (const name of collections) {
    if (name === "users") {
      const r = await db.collection("users").deleteMany(PROTECT_USERS_FILTER);
      console.log(`  users: removed ${r.deletedCount} non-admin users`);
    } else {
      const r = await db.collection(name).deleteMany({});
      console.log(`  ${name}: removed ${r.deletedCount}`);
    }
  }

  // Seed marketplace category tree.
  console.log("\nSeeding marketplace categories…");
  const now = new Date();
  const cats = db.collection("categories");
  let topPos = 0;
  for (const top of TREE) {
    const parent = {
      name: { en: top.en, bn: top.bn },
      slug: slugify(top.en),
      parentId: null,
      storefront: "marketplace",
      position: topPos++,
      featured: true,
      icon: top.icon,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await cats.insertOne(parent);
    let childPos = 0;
    for (const child of top.children) {
      await cats.insertOne({
        name: { en: child },
        slug: slugify(`${top.en}-${child}`),
        parentId: insertedId,
        storefront: "marketplace",
        position: childPos++,
        featured: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const total = await cats.countDocuments({ storefront: "marketplace" });
  console.log(`  seeded ${total} marketplace categories`);

  // Re-seed corporate homepage content.
  await db.collection("testimonials").insertMany(testimonials);
  await db.collection("posts").insertMany(posts);
  console.log(
    `  seeded ${testimonials.length} testimonials + ${posts.length} news posts`,
  );

  console.log(
    "\n✓ Reset + seed complete. Run `npm run sync-indexes` to ensure indexes.\n",
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
