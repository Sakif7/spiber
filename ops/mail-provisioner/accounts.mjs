// The two docker-mailserver config files the sidecar is allowed to touch:
//
//   postfix-accounts.cf   user@domain|{SHA512-CRYPT}$6$…      one per mailbox
//   dovecot-quotas.cf     user@domain:5G                     optional
//
// Both are plain text in the `dms-config` volume; DMS's changedetector picks
// up a checksum change within seconds and reloads Postfix/Dovecot. Writes go
// through a temp file + rename so a half-written line can never be read, and
// through one promise chain so two requests cannot interleave.
import { promises as fs } from "node:fs";
import path from "node:path";
import { sha512Crypt } from "./sha512-crypt.mjs";

const ADDRESS = /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,}$/;
/** "5G", "500M", "0" (unlimited) — what Dovecot's quota plugin accepts. */
const QUOTA = /^(0|[1-9][0-9]{0,5}[MG])$/;

export function isAddress(s) {
  return typeof s === "string" && ADDRESS.test(s);
}
export function isQuota(s) {
  return typeof s === "string" && QUOTA.test(s);
}

export class AccountsStore {
  constructor(dir) {
    this.accountsFile = path.join(dir, "postfix-accounts.cf");
    this.quotasFile = path.join(dir, "dovecot-quotas.cf");
    this.queue = Promise.resolve();
  }

  /** Serialise every mutation; a failure in one must not block the next. */
  locked(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async readLines(file) {
    try {
      const text = await fs.readFile(file, "utf8");
      return text.split("\n").filter((l) => l.trim() !== "");
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }

  async writeLines(file, lines) {
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, lines.join("\n") + "\n", { mode: 0o644 });
    await fs.rename(tmp, file);
  }

  async list() {
    const [accounts, quotas] = await Promise.all([
      this.readLines(this.accountsFile),
      this.readLines(this.quotasFile),
    ]);
    const quotaOf = new Map(
      quotas.map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).toLowerCase(), l.slice(i + 1)];
      }),
    );
    return accounts.map((l) => {
      const address = l.slice(0, l.indexOf("|")).toLowerCase();
      return { address, quota: quotaOf.get(address) ?? null };
    });
  }

  async get(address) {
    const all = await this.list();
    return all.find((a) => a.address === address) ?? null;
  }

  /** Create; `false` when the address already exists (nothing written). */
  create(address, password, quota) {
    return this.locked(async () => {
      const lines = await this.readLines(this.accountsFile);
      if (lines.some((l) => l.toLowerCase().startsWith(`${address}|`))) {
        return false;
      }
      lines.push(`${address}|{SHA512-CRYPT}${sha512Crypt(password)}`);
      await this.writeLines(this.accountsFile, lines);
      if (quota) await this.writeQuota(address, quota);
      return true;
    });
  }

  /** Replace the hash; `false` when the address is unknown. */
  setPassword(address, password) {
    return this.locked(async () => {
      const lines = await this.readLines(this.accountsFile);
      const i = lines.findIndex((l) =>
        l.toLowerCase().startsWith(`${address}|`),
      );
      if (i < 0) return false;
      lines[i] = `${address}|{SHA512-CRYPT}${sha512Crypt(password)}`;
      await this.writeLines(this.accountsFile, lines);
      return true;
    });
  }

  setQuota(address, quota) {
    return this.locked(async () => {
      const lines = await this.readLines(this.accountsFile);
      if (!lines.some((l) => l.toLowerCase().startsWith(`${address}|`))) {
        return false;
      }
      await this.writeQuota(address, quota);
      return true;
    });
  }

  /** Caller holds the lock. "0" removes the line (unlimited). */
  async writeQuota(address, quota) {
    const lines = (await this.readLines(this.quotasFile)).filter(
      (l) => !l.toLowerCase().startsWith(`${address}:`),
    );
    if (quota !== "0") lines.push(`${address}:${quota}`);
    await this.writeLines(this.quotasFile, lines);
  }

  /** Remove the account line (the maildir on disk is left alone). */
  remove(address) {
    return this.locked(async () => {
      const lines = await this.readLines(this.accountsFile);
      const kept = lines.filter(
        (l) => !l.toLowerCase().startsWith(`${address}|`),
      );
      if (kept.length === lines.length) return false;
      await this.writeLines(this.accountsFile, kept);
      await this.writeQuota(address, "0");
      return true;
    });
  }
}
