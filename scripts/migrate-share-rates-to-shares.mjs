/**
 * ONE-TIME MIGRATION — director pay moved from a percentage of revenue to a
 * shareholding in a fixed pool (2026-09-13).
 *
 * WHY
 *   The first version of payroll paid each director a percentage of the
 *   month's revenue (`employee_share_rates.rateBp`). The company never actually
 *   worked that way: it issued a fixed pool of shares and each director bought
 *   some, so a month's distributable profit is split by holding. Payroll now
 *   reads `shares` on the same rows; a row that still only carries `rateBp` is
 *   computed the old way and shown as "percentage scheme, not migrated" until
 *   this script rewrites it.
 *
 * WHAT IT DOES
 *   1. Sets the share pool (Settings key `hr.sharePool`) to --pool, with the
 *      optional --face-value, unless a pool is already set.
 *   2. Rewrites every percentage row as a holding of --shares shares, keeping
 *      its effective month and note; the percentage is kept on the row as
 *      `legacyRateBp` so the original agreement is never lost.
 *
 *   --shares applies to EVERY percentage row, which is right when there is one
 *   (the case this was written for) and wrong otherwise: with several rows on
 *   different percentages the script refuses and asks for one run per
 *   employee (--employee <code>).
 *
 * SAFE TO RE-RUN
 *   A row that already has `shares` is left alone; a pool already set is not
 *   overwritten (pass --pool-force to replace it).
 *
 * USAGE
 *   node scripts/migrate-share-rates-to-shares.mjs --pool 14000 --shares 2000              # DRY RUN
 *   node scripts/migrate-share-rates-to-shares.mjs --pool 14000 --face-value 100 --shares 2000 --commit
 *   node scripts/migrate-share-rates-to-shares.mjs --pool 14000 --shares 2000 --employee SPM-EMP-… --commit
 *   … --commit --force-prod                                                            # a NON-local Mongo
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
const opt = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const int = (v) => (v === undefined ? undefined : Number.parseInt(v, 10));

const COMMIT = has("--commit");
const FORCE_PROD = has("--force-prod");
const POOL_FORCE = has("--pool-force");
const POOL = int(opt("--pool"));
const FACE_VALUE_TAKA = opt("--face-value")
  ? Number(opt("--face-value"))
  : null;
const SHARES = int(opt("--shares"));
const EMPLOYEE = opt("--employee");

if (!Number.isInteger(POOL) || POOL <= 0) {
  console.error("--pool <shares issued> is required (e.g. --pool 14000).");
  process.exit(1);
}
if (!Number.isInteger(SHARES) || SHARES < 0) {
  console.error("--shares <shares held> is required (e.g. --shares 2000).");
  process.exit(1);
}

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

const POOL_KEY = "hr.sharePool";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const rates = db.collection("employee_share_rates");
  const employees = db.collection("employees");
  const settings = db.collection("settings");

  console.log(`\nDB: ${dbName} @ ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log(COMMIT ? "MODE: COMMIT (writing)\n" : "MODE: DRY RUN\n");

  // ── the pool
  const existingPool = await settings.findOne({ key: POOL_KEY });
  const pool = {
    totalShares: POOL,
    faceValueMinor:
      FACE_VALUE_TAKA != null ? Math.round(FACE_VALUE_TAKA * 100) : null,
  };
  const writePool = !existingPool || POOL_FORCE;
  console.log("Share pool:");
  if (existingPool && !POOL_FORCE) {
    console.log(
      `  already set: ${JSON.stringify(existingPool.value)} — left alone (pass --pool-force to replace)`,
    );
  } else {
    console.log(
      `  ${existingPool ? "replace" : "set"}: ${pool.totalShares} shares` +
        (pool.faceValueMinor != null
          ? ` at ৳${FACE_VALUE_TAKA} each (paid-up ৳${(pool.totalShares * FACE_VALUE_TAKA).toLocaleString("en-BD")})`
          : ""),
    );
  }

  // ── the rows
  let filter = { $or: [{ shares: { $exists: false } }, { shares: null }] };
  if (EMPLOYEE) {
    const emp = await employees.findOne({ code: EMPLOYEE });
    if (!emp) {
      console.error(`\nNo employee with code ${EMPLOYEE}.`);
      await client.close();
      process.exit(1);
    }
    filter = { ...filter, employeeId: emp._id };
  }
  const legacy = await rates.find(filter).toArray();
  const byEmployee = new Map();
  for (const r of legacy) {
    const k = String(r.employeeId);
    byEmployee.set(k, [...(byEmployee.get(k) ?? []), r]);
  }
  const ids = [...new Set(legacy.map((r) => String(r.employeeId)))].map(
    (k) => legacy.find((r) => String(r.employeeId) === k).employeeId,
  );
  const names = new Map(
    (await employees.find({ _id: { $in: ids } }).toArray()).map((e) => [
      String(e._id),
      `${e.name} (${e.code})`,
    ]),
  );

  console.log(`\nPercentage rows still to migrate: ${legacy.length}`);
  for (const r of legacy) {
    console.log(
      `  - ${names.get(String(r.employeeId)) ?? r.employeeId}: ${(r.rateBp ?? 0) / 100}% from ${r.effectiveFrom}${r.note ? ` — "${r.note}"` : ""}` +
        `  →  ${SHARES} shares (${((SHARES / POOL) * 100).toFixed(2)}% of the pool)`,
    );
  }

  const distinctRates = new Set(legacy.map((r) => r.rateBp ?? 0));
  if (byEmployee.size > 1 && distinctRates.size > 1) {
    console.error(
      `\nRefusing: ${byEmployee.size} employees on ${distinctRates.size} different percentages would all become ${SHARES} shares. Run once per employee with --employee <code>.`,
    );
    await client.close();
    process.exit(1);
  }
  if (legacy.length * SHARES > POOL) {
    console.error(
      `\nRefusing: ${legacy.length} rows × ${SHARES} shares = ${legacy.length * SHARES}, more than the pool of ${POOL}.`,
    );
    await client.close();
    process.exit(1);
  }

  if (!COMMIT) {
    console.log("\nDry run — nothing written. Re-run with --commit.\n");
    await client.close();
    return;
  }

  if (writePool) {
    await settings.updateOne(
      { key: POOL_KEY },
      { $set: { value: pool } },
      { upsert: true },
    );
    console.log("\nPool written.");
  }

  let rewritten = 0;
  for (const r of legacy) {
    const res = await rates.updateOne(
      { _id: r._id, $or: [{ shares: { $exists: false } }, { shares: null }] },
      {
        $set: {
          shares: SHARES,
          rateBp: null,
          legacyRateBp: r.rateBp ?? null,
          note: r.note
            ? `${r.note} — migrated from ${(r.rateBp ?? 0) / 100}%`
            : `Migrated from ${(r.rateBp ?? 0) / 100}%`,
        },
      },
    );
    rewritten += res.modifiedCount;
  }
  console.log(`Rewrote ${rewritten} row(s).\n`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
