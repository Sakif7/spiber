/**
 * The app, with no Docker.
 *
 *   npm run dev:sandbox
 *
 * Boots MongoDB in memory (the binary is already cached by the test suite),
 * seeds enough of a business to exercise the admin — an admin account, a
 * catalogue with cost prices, a client, and paid sales on both sides of the
 * house — then starts `next dev` pointed at it.
 *
 * The database lives only as long as this process. Anything created by hand is
 * gone on Ctrl+C, which is the trade for not running a database daemon; the
 * seed is deterministic, so restarting puts the same world back.
 */
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const PORT = Number(process.env.SANDBOX_MONGO_PORT || 27018);
const DB = "spibermed";
const ADMIN = {
  email: "admin@sandbox.test",
  password: "sandbox",
  name: "Sandbox Admin",
};

const money = (taka) => Math.round(taka * 100);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

console.log("Starting an in-memory MongoDB…");
const mongo = await MongoMemoryServer.create({
  instance: { port: PORT, dbName: DB },
});
const uri = mongo.getUri();
const client = new MongoClient(uri);
await client.connect();
const db = client.db(DB);

/* ── the world ─────────────────────────────────────────────────────────── */

const now = new Date();
const ids = {
  admin: new ObjectId(),
  catMedical: new ObjectId(),
  catDiagnostics: new ObjectId(),
  brand: new ObjectId(),
  ecg: new ObjectId(),
  syringe: new ObjectId(),
  bp: new ObjectId(),
  lead1: new ObjectId(),
  lead2: new ObjectId(),
};

await db.collection("users").insertOne({
  _id: ids.admin,
  name: ADMIN.name,
  email: ADMIN.email,
  passwordHash: await bcrypt.hash(ADMIN.password, 12),
  roles: ["super_admin"],
  emailVerified: true,
  locale: "en",
  createdAt: now,
  updatedAt: now,
});

await db.collection("categories").insertMany([
  {
    _id: ids.catDiagnostics,
    name: { en: "Diagnostics" },
    slug: "diagnostics",
    storefront: "instruments",
    parentId: null,
    position: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.catMedical,
    name: { en: "Medical" },
    slug: "medical",
    storefront: "marketplace",
    parentId: null,
    position: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  },
]);

await db.collection("brands").insertOne({
  _id: ids.brand,
  name: { en: "Medtrade" },
  slug: "medtrade",
  position: 0,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
});

const product = (id, over) => ({
  _id: id,
  name: { en: over.name },
  slug: over.slug,
  sku: over.sku,
  description: { en: over.description ?? "" },
  storefront: over.storefront,
  categoryId: over.categoryId,
  brandId: ids.brand,
  priceMinor: over.priceMinor,
  costPriceMinor: over.costPriceMinor,
  stockQty: over.stockQty ?? 0,
  reservedQty: 0,
  lowStockThreshold: 5,
  status: "active",
  featured: false,
  images: [],
  specs: [],
  variants: [],
  variantOptions: [],
  approvalStatus: "approved",
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
});

await db.collection("products").insertMany([
  product(ids.ecg, {
    name: "12-Channel ECG Machine",
    slug: "12-channel-ecg-machine",
    sku: "INS-ECG-01",
    description: "Twelve-lead diagnostic ECG with thermal printer.",
    storefront: "instruments",
    categoryId: ids.catDiagnostics,
    priceMinor: money(185000),
    costPriceMinor: money(138000),
    stockQty: 6,
  }),
  product(ids.syringe, {
    name: "Disposable Syringe 5ml",
    slug: "disposable-syringe-5ml",
    sku: "INS-SYR-05",
    description: "Sterile single-use syringe, box of 100.",
    storefront: "instruments",
    categoryId: ids.catDiagnostics,
    priceMinor: money(500),
    costPriceMinor: money(310),
    stockQty: 400,
  }),
  product(ids.bp, {
    name: "Omron Digital BP Monitor",
    slug: "omron-digital-bp-monitor",
    sku: "MKT-BP-01",
    description: "Upper-arm automatic blood pressure monitor.",
    storefront: "marketplace",
    categoryId: ids.catMedical,
    priceMinor: money(3200),
    costPriceMinor: money(2150),
    stockQty: 25,
  }),
]);

await db.collection("sales_leads").insertMany([
  {
    _id: ids.lead1,
    code: "PDC",
    organisation: "Popular Diagnostic Centre",
    address: "House 16, Road 2, Dhanmondi, Dhaka-1205",
    contactName: "Nusrat Jahan",
    phone: "+880 1711 223344",
    email: "procurement@popular.test",
    status: "won",
    activity: [],
    deletedAt: null,
    createdAt: daysAgo(60),
    updatedAt: now,
  },
  {
    _id: ids.lead2,
    code: "SQH",
    organisation: "Square Hospital",
    address: "18/F Bir Uttam Qazi Nuruzzaman Road, Dhaka-1205",
    contactName: "Dr. Farhana Islam",
    phone: "+880 1811 556677",
    email: "supplies@square.test",
    status: "won",
    activity: [],
    deletedAt: null,
    createdAt: daysAgo(40),
    updatedAt: now,
  },
]);

/** A paid offline sale, with a cost on every line. */
const salesOrder = (over) => ({
  costs: over.costs ?? [],
  withholding: over.withholding ?? null,
  _id: new ObjectId(),
  number: over.number,
  leadId: over.leadId,
  leadSnapshot: over.leadSnapshot,
  status: "delivered",
  items: over.items,
  subtotalMinor: over.items.reduce((s, i) => s + i.lineTotalMinor, 0),
  discountMinor: 0,
  deliveryMinor: 0,
  vatRateBp: 1500,
  vatMinor: Math.round(
    over.items.reduce((s, i) => s + i.lineTotalMinor, 0) * 0.15,
  ),
  totalMinor: 0,
  terms: { deliveryDays: 2, validityDays: 7, paymentDays: 30 },
  proposals: [],
  invoices: [],
  invoiceNumber: over.invoiceNumber,
  payment: {
    status: "paid",
    method: over.method ?? "bank",
    paidMinor: 0,
    paidAt: over.paidAt,
    reference: over.reference ?? null,
  },
  activity: [],
  createdBy: ids.admin,
  deletedAt: null,
  createdAt: over.paidAt,
  updatedAt: now,
});

const line = (over) => ({
  id: new ObjectId().toString(),
  kind: over.kind,
  productId: over.productId ?? null,
  variantId: null,
  sku: over.sku ?? null,
  description: over.description,
  brandOrigin: over.brandOrigin ?? "",
  specification: over.specification ?? "",
  unit: "pcs",
  unitPriceMinor: over.price,
  unitCostMinor: over.cost,
  qty: over.qty,
  lineTotalMinor: over.price * over.qty,
  reservedQty: 0,
});

const orders = [
  salesOrder({
    number: "SPM-SO-SBX0001",
    leadId: ids.lead1,
    leadSnapshot: {
      code: "PDC",
      organisation: "Popular Diagnostic Centre",
      address: "House 16, Road 2, Dhanmondi, Dhaka-1205",
      contactName: "Nusrat Jahan",
      phone: "+880 1711 223344",
      email: "procurement@popular.test",
    },
    invoiceNumber: "SPIBER/PDC/8-9/26-1",
    paidAt: daysAgo(21),
    // Real money this sale cost us, beyond the goods.
    costs: [
      {
        id: "c1",
        label: "Delivery to Dhanmondi",
        amountMinor: money(3000),
        addedAt: daysAgo(21),
      },
      {
        id: "c2",
        label: "Installation engineer",
        amountMinor: money(4500),
        addedAt: daysAgo(20),
      },
    ],
    items: [
      line({
        kind: "inventory",
        productId: ids.ecg,
        sku: "INS-ECG-01",
        description: "12-Channel ECG Machine",
        price: money(185000),
        cost: money(138000),
        qty: 1,
      }),
      line({
        kind: "inventory",
        productId: ids.syringe,
        sku: "INS-SYR-05",
        description: "Disposable Syringe 5ml",
        price: money(500),
        cost: money(310),
        qty: 200,
      }),
    ],
  }),
  salesOrder({
    number: "SPM-SO-SBX0002",
    leadId: ids.lead2,
    leadSnapshot: {
      code: "SQH",
      organisation: "Square Hospital",
      address: "18/F Bir Uttam Qazi Nuruzzaman Road, Dhaka-1205",
      contactName: "Dr. Farhana Islam",
      phone: "+880 1811 556677",
      email: "supplies@square.test",
    },
    invoiceNumber: "SPIBER/SQH/8-9/26-2",
    paidAt: daysAgo(9),
    costs: [
      {
        id: "c1",
        label: "Freight from supplier",
        amountMinor: money(9000),
        addedAt: daysAgo(9),
      },
    ],
    // The client told us after invoicing that they withhold 5%.
    withholding: {
      aitRateBp: 500,
      aitMinor: money(26450),
      certificateReceived: false,
      recordedAt: daysAgo(7),
    },
    items: [
      line({
        kind: "external",
        description: "Autoclave 24L (bought in for this order)",
        brandOrigin: "Runyes / China",
        price: money(96000),
        cost: money(71500),
        qty: 1,
      }),
      line({
        kind: "inventory",
        productId: ids.ecg,
        sku: "INS-ECG-01",
        description: "12-Channel ECG Machine",
        price: money(182000),
        cost: money(138000),
        qty: 2,
      }),
    ],
  }),
];
for (const o of orders) {
  o.totalMinor = o.subtotalMinor + o.vatMinor;
  o.payment.paidMinor = o.totalMinor;
}
await db.collection("sales_orders").insertMany(orders);

/** An unpaid one, so receivables have something to show. */
const outstanding = salesOrder({
  number: "SPM-SO-SBX0003",
  leadId: ids.lead1,
  leadSnapshot: orders[0].leadSnapshot,
  invoiceNumber: "SPIBER/PDC/8-9/26-3",
  paidAt: null,
  items: [
    line({
      kind: "inventory",
      productId: ids.syringe,
      sku: "INS-SYR-05",
      description: "Disposable Syringe 5ml",
      price: money(500),
      cost: money(310),
      qty: 500,
    }),
  ],
});
outstanding.status = "invoiced";
outstanding.totalMinor = outstanding.subtotalMinor + outstanding.vatMinor;
outstanding.payment = {
  status: "unpaid",
  method: "bank",
  paidMinor: 0,
  paidAt: null,
  reference: null,
};
outstanding.createdAt = daysAgo(35);
await db.collection("sales_orders").insertOne(outstanding);

/** Two paid online orders, cost frozen on the line. */
await db.collection("orders").insertMany(
  [1, 2].map((n) => ({
    _id: new ObjectId(),
    orderNumber: `SPM-SBX000${n}`,
    storefront: "marketplace",
    userId: null,
    guestId: `sandbox-${n}`,
    email: "customer@sandbox.test",
    items: [
      {
        productId: ids.bp,
        // An online line keeps its snapshot, cost frozen beside the price.
        productSnapshot: {
          name: { en: "Omron Digital BP Monitor" },
          sku: "MKT-BP-01",
          priceMinor: money(3200),
          costPriceMinor: money(2150),
          variantId: null,
          variantOptions: [],
          sellerId: null,
        },
        qty: n,
        lineTotalMinor: money(3200) * n,
      },
    ],
    subtotalMinor: money(3200) * n,
    discountMinor: 0,
    shippingMinor: money(80),
    taxMinor: 0,
    totalMinor: money(3200) * n + money(80),
    status: "delivered",
    payment: {
      provider: "manual",
      method: "cod",
      status: "paid",
      paidAt: daysAgo(n * 5),
      raw: null,
    },
    timeline: [],
    deletedAt: null,
    createdAt: daysAgo(n * 5),
    updatedAt: now,
  })),
);

await client.close();

/* ── hand over to Next ──────────────────────────────────────────────────── */

console.log(`
  In-memory MongoDB on port ${PORT} (database "${DB}")
  Sign in at http://localhost:3000/admin
    email     ${ADMIN.email}
    password  ${ADMIN.password}

  Seeded: 3 products with cost prices, 2 clients, 3 offline sales
  (2 paid, 1 outstanding) and 2 paid online orders.
  Everything disappears when you stop this process.
`);

const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DB: DB,
    ALLOW_LOCAL_STORAGE: "true",
  },
});

const shutdown = async () => {
  next.kill();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", shutdown);
