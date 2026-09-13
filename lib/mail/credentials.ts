import { randomBytes } from "crypto";
import {
  decryptVaultBlob,
  encryptVaultBlob,
  getVaultKey,
} from "@/lib/crypto/vault";

/**
 * A mailbox's own password, kept only so it can be handed to a phone or
 * desktop mail client. Encrypted with the same company vault key as the
 * documents; without the key nothing is ever stored in the clear — the
 * service refuses to provision instead.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 24 chars from an unambiguous alphabet: ~140 bits, no `|`, no newline. */
export function generateMailboxPassword(): string {
  const bytes = randomBytes(24);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export class VaultKeyMissing extends Error {
  constructor() {
    super("COMPANY_VAULT_KEY is not configured");
    this.name = "VaultKeyMissing";
  }
}

export function encryptMailboxPassword(password: string): Buffer {
  const key = getVaultKey();
  if (!key) throw new VaultKeyMissing();
  return encryptVaultBlob(Buffer.from(password, "utf8"), key);
}

/**
 * What a Buffer field looks like after `.lean()`: a BSON `Binary` (with a
 * `.buffer` of bytes), a Buffer from a hydrated doc, or the JSON shape. A
 * bare `Buffer.from(binary)` on the Binary silently produces garbage, which
 * is exactly the kind of bug that would only show up on the first reveal.
 */
export function ciphertextToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value === "object") {
    const v = value as { buffer?: unknown; data?: unknown };
    if (v.buffer instanceof Uint8Array) return Buffer.from(v.buffer);
    if (Array.isArray(v.data)) return Buffer.from(v.data as number[]);
  }
  throw new Error("mailbox password: unreadable ciphertext");
}

export function decryptMailboxPassword(blob: unknown): string {
  const key = getVaultKey();
  if (!key) throw new VaultKeyMissing();
  return decryptVaultBlob(ciphertextToBuffer(blob), key).toString("utf8");
}
