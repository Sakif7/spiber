import { MailProvisionError, type MailProvisioner } from "./types";

/**
 * In-process provisioner for tests and the sandbox: the accounts live in a
 * Map on `globalThis` (so Next's HMR keeps them across module reloads) and
 * vanish when the process does. Behaves exactly like the sidecar's API,
 * error codes included, so the service is exercised the same way.
 */
type Row = { password: string; quota: string | null };

declare global {
  var __mailAccounts: Map<string, Row> | undefined;
}

/** What the real server starts with: the two accounts DMS was set up with. */
const PRESEEDED = ["info", "postmaster"];

function seeded(): Map<string, Row> {
  const domain = (
    process.env.MAIL_DOMAIN?.trim() || "spibermed.com"
  ).toLowerCase();
  return new Map(
    PRESEEDED.map((l) => [
      `${l}@${domain}`,
      { password: "preseeded-fixture-secret", quota: "5G" },
    ]),
  );
}

function table(): Map<string, Row> {
  globalThis.__mailAccounts ??= seeded();
  return globalThis.__mailAccounts;
}

export const memoryProvisioner: MailProvisioner & {
  /** Test hook: what the server would know. */
  _peek(address: string): Row | null;
  _reset(): void;
} = {
  name: "memory",
  async list() {
    return [...table()].map(([address, r]) => ({ address, quota: r.quota }));
  },
  async get(address) {
    const r = table().get(address);
    return r ? { address, quota: r.quota } : null;
  },
  async create({ address, password, quota }) {
    if (table().has(address)) throw new MailProvisionError("exists");
    if (password.length < 12) throw new MailProvisionError("bad_password");
    table().set(address, { password, quota: quota ?? null });
  },
  async setPassword(address, password) {
    const r = table().get(address);
    if (!r) throw new MailProvisionError("not_found");
    if (password.length < 12) throw new MailProvisionError("bad_password");
    r.password = password;
  },
  async setQuota(address, quota) {
    const r = table().get(address);
    if (!r) throw new MailProvisionError("not_found");
    r.quota = quota === "0" ? null : quota;
  },
  async remove(address) {
    if (!table().delete(address)) throw new MailProvisionError("not_found");
  },
  _peek(address) {
    return table().get(address) ?? null;
  },
  _reset() {
    globalThis.__mailAccounts = seeded();
  },
};
