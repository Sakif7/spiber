import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Application-layer encryption at rest for the company document vault
 * (AES-256-GCM). Prod stores files on the VPS's local disk, so without this a
 * copy of the volume (or its backups) exposes every document; with it the
 * stored blobs are unreadable outside the app.
 *
 * Key = `COMPANY_VAULT_KEY` env: 64 hex chars (32 random bytes). Generate one:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * ⚠ Losing the key loses every stored document — keep it in the Coolify env
 * (and a password manager), never in the repo or the database.
 *
 * Blob layout: MAGIC("SPV1") | iv(12) | authTag(16) | ciphertext. GCM
 * authenticates the whole blob, so any at-rest tampering fails decryption.
 */

const MAGIC = Buffer.from("SPV1");
const IV_LEN = 12;
const TAG_LEN = 16;

export function getVaultKey(): Buffer | null {
  const hex = process.env.COMPANY_VAULT_KEY?.trim();
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

export function vaultConfigured(): boolean {
  return getVaultKey() !== null;
}

export function encryptVaultBlob(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

/** Throws on a wrong key, truncated blob, or any tampering (GCM auth). */
export function decryptVaultBlob(blob: Buffer, key: Buffer): Buffer {
  if (
    blob.length < MAGIC.length + IV_LEN + TAG_LEN ||
    !blob.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error("vault: not an encrypted blob");
  }
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = blob.subarray(
    MAGIC.length + IV_LEN,
    MAGIC.length + IV_LEN + TAG_LEN,
  );
  const ciphertext = blob.subarray(MAGIC.length + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
