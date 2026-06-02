/**
 * One-time super-admin bootstrap.
 *
 *   npm run create-admin -- <email> [name]
 *
 * Creates (or promotes) a user to `super_admin`, marks the email verified so
 * you can sign in immediately, generates a strong random password, and prints
 * the credentials to the console once. Safer than committing a password to env
 * or fishing a verification link out of the logs.
 *
 * Reads MONGODB_URI from the environment, falling back to .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

const email = (process.argv[2] || process.env.SUPER_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();
const name = process.argv[3] || "Super Admin";
const uri = process.env.MONGODB_URI;

if (!email) {
  console.error("Usage: npm run create-admin -- <email> [name]");
  process.exit(1);
}
if (!uri) {
  console.error("MONGODB_URI is not set (checked env and .env.local).");
  process.exit(1);
}

const password = crypto.randomBytes(12).toString("base64url");

async function main() {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "spiber" });
  const users = mongoose.connection.collection("users");
  const existing = await users.findOne({ email });
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  if (existing) {
    const roles = Array.from(
      new Set([...(existing.roles ?? []), "super_admin"]),
    );
    await users.updateOne(
      { email },
      { $set: { passwordHash, roles, emailVerified: true, updatedAt: now } },
    );
    console.log("\n✓ Existing user promoted to super_admin (password reset).");
  } else {
    await users.insertOne({
      name,
      email,
      passwordHash,
      roles: ["super_admin"],
      emailVerified: true,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    console.log("\n✓ Super admin created.");
  }

  console.log("──────────────────────────────────────────");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     super_admin (email verified)`);
  console.log("──────────────────────────────────────────");
  console.log("Sign in at /en/login, then change this password.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
