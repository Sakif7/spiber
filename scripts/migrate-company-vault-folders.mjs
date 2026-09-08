/**
 * ONE-TIME MIGRATION — the company vault gained a real folder tree.
 *
 * WHY
 *   A vault document used to carry a free-text `folder` string, so there was
 *   one flat level of grouping and no way to rename or move it. Folders are now
 *   rows in `company_folders`, and each document points at one with `folderId`
 *   plus a denormalised `ancestors` chain.
 *
 *   Documents written before the change have neither field. They still LOAD
 *   (both are optional), but they would all appear at the vault root with their
 *   old grouping lost. This script turns each distinct legacy `folder` string
 *   into a real root folder and files its documents into it.
 *
 *   It also fills in the two derived fields every document now needs:
 *     nameLower — case-insensitive uniqueness within a folder
 *     ext       — the type column and the file icon
 *   and carries a legacy `deletedAt` across to `trashedAt`, so anything that was
 *   soft-deleted lands in the trash rather than reappearing as live.
 *
 * SAFE TO RE-RUN
 *   Documents that already have a `folderId` are skipped, and folders are
 *   found-or-created by name, so a second run reports 0 changes.
 *
 * USAGE
 *   node scripts/migrate-company-vault-folders.mjs                  # DRY RUN
 *   node scripts/migrate-company-vault-folders.mjs --commit         # apply (local)
 *   node scripts/migrate-company-vault-folders.mjs --commit --force-prod
 *
 * Guards mirror the other migrations: nothing is written without --commit, and
 * a non-local Mongo host is refused without --force-prod.
 */
import fs from "node:fs";
import path from "node:path";
import { MongoClient, ObjectId } from "mongodb";

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
    return LOCAL_HOSTS.includes(
      new URL(u.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname,
    );
  } catch {
    return false;
  }
}

if (COMMIT && !hostIsLocal(uri) && !FORCE_PROD) {
  console.error(
    "Refusing to write to a non-local Mongo without --force-prod.\n" +
      `  host: ${new URL(uri.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname}`,
  );
  process.exit(1);
}

/** "report.pdf" → "pdf" */
function extOf(filename) {
  const dot = String(filename ?? "").lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return undefined;
  return filename.slice(dot + 1).toLowerCase();
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const folders = db.collection("company_folders");
  const docs = db.collection("company_documents");

  const total = await docs.countDocuments({});
  const pending = await docs.find({ folderId: { $exists: false } }).toArray();

  console.log(`\nCompany vault → folder tree`);
  console.log(`  database:            ${dbName}`);
  console.log(`  documents total:     ${total}`);
  console.log(`  needing migration:   ${pending.length}`);

  if (pending.length === 0) {
    console.log("\nNothing to do — every document already has a folder.\n");
    process.exit(0);
  }

  // Distinct legacy folder names, preserving the first casing seen.
  const byLower = new Map();
  for (const d of pending) {
    const name = typeof d.folder === "string" ? d.folder.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, name);
  }

  const atRoot = pending.filter(
    (d) => !(typeof d.folder === "string" && d.folder.trim()),
  ).length;

  console.log(`  folders to create:   ${byLower.size}`);
  for (const name of byLower.values()) console.log(`      · ${name}`);
  console.log(`  documents to root:   ${atRoot}`);
  const trashed = pending.filter((d) => d.deletedAt).length;
  console.log(`  soft-deleted → trash:${trashed}`);

  if (!COMMIT) {
    console.log(
      "\nDRY RUN — nothing written. Re-run with --commit to apply.\n",
    );
    process.exit(0);
  }

  // The migration has no admin session, so ownership is attributed to the
  // document's own uploader (or the first super-admin as a fallback).
  const fallbackOwner = await db
    .collection("users")
    .findOne({ roles: "super_admin" }, { projection: { _id: 1, email: 1 } });

  const folderIdByLower = new Map();
  for (const [lower, name] of byLower) {
    const existing = await folders.findOne({
      parentId: null,
      nameLower: lower,
      trashedAt: null,
      purgedAt: null,
    });
    if (existing) {
      folderIdByLower.set(lower, existing._id);
      continue;
    }
    const owner =
      pending.find((d) => (d.folder ?? "").trim().toLowerCase() === lower)
        ?.uploadedBy ?? fallbackOwner?._id;
    const res = await folders.insertOne({
      name,
      nameLower: lower,
      parentId: null,
      ancestors: [],
      depth: 0,
      createdBy: owner ? new ObjectId(String(owner)) : null,
      createdByEmail: fallbackOwner?.email,
      trashedAt: null,
      trashedRoot: false,
      trashedFromParentId: null,
      purgedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    folderIdByLower.set(lower, res.insertedId);
  }

  let moved = 0;
  for (const d of pending) {
    const lower = (
      typeof d.folder === "string" ? d.folder.trim() : ""
    ).toLowerCase();
    const folderId = lower ? (folderIdByLower.get(lower) ?? null) : null;
    const title = d.title ?? d.originalFilename ?? "Untitled";

    await docs.updateOne(
      { _id: d._id },
      {
        $set: {
          folderId,
          ancestors: folderId ? [folderId] : [],
          nameLower: String(title).toLowerCase(),
          ext: extOf(d.originalFilename) ?? null,
          // A legacy soft-delete becomes a trashed item, restorable in the UI.
          trashedAt: d.deletedAt ?? null,
          trashedRoot: d.deletedAt ? true : false,
          trashedFromFolderId: d.deletedAt ? folderId : null,
          purgedAt: null,
        },
      },
    );
    moved += 1;
  }

  console.log(`\n  folders created:     ${folderIdByLower.size}`);
  console.log(`  documents filed:     ${moved}`);
  console.log("\nDone.\n");
} finally {
  await client.close();
}
