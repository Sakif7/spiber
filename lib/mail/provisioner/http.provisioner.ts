import { logger } from "@/lib/log";
import {
  MailProvisionError,
  type MailAccount,
  type MailProvisioner,
  type ProvisionError,
} from "./types";

/**
 * Talks to `ops/mail-provisioner` (the sidecar in the Coolify mail stack):
 *   MAIL_PROVISIONER_URL      http://mail-provisioner:8025
 *   MAIL_PROVISIONER_SECRET   the sidecar's bearer secret
 */
function config() {
  const url = process.env.MAIL_PROVISIONER_URL?.replace(/\/+$/, "");
  const secret = process.env.MAIL_PROVISIONER_SECRET;
  if (!url || !secret) {
    throw new MailProvisionError(
      "not_configured",
      "MAIL_PROVISIONER=http needs MAIL_PROVISIONER_URL and MAIL_PROVISIONER_SECRET",
    );
  }
  return { url, secret };
}

const KNOWN: ProvisionError[] = [
  "exists",
  "not_found",
  "bad_password",
  "bad_quota",
  "bad_address",
  "wrong_domain",
];

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { url, secret } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (e) {
    logger.error("mail provisioner unreachable", { path, error: String(e) });
    throw new MailProvisionError("unavailable", String(e));
  }
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (res.ok) return json;
  if (res.status === 401) throw new MailProvisionError("unauthorised");
  const code = json?.error;
  if (code && (KNOWN as string[]).includes(code)) {
    throw new MailProvisionError(code as ProvisionError);
  }
  logger.error("mail provisioner error", { path, status: res.status, code });
  throw new MailProvisionError("unavailable", `HTTP ${res.status}`);
}

const enc = (address: string) => encodeURIComponent(address);

export const httpProvisioner: MailProvisioner = {
  name: "http",
  async list() {
    const out = (await call("GET", "/accounts")) as { accounts: MailAccount[] };
    return out.accounts;
  },
  async get(address) {
    try {
      return (await call("GET", `/accounts/${enc(address)}`)) as MailAccount;
    } catch (e) {
      if (e instanceof MailProvisionError && e.code === "not_found")
        return null;
      throw e;
    }
  },
  async create({ address, password, quota }) {
    await call("PUT", `/accounts/${enc(address)}`, { password, quota });
  },
  async setPassword(address, password) {
    await call("PUT", `/accounts/${enc(address)}/password`, { password });
  },
  async setQuota(address, quota) {
    await call("PUT", `/accounts/${enc(address)}/quota`, { quota });
  },
  async remove(address) {
    await call("DELETE", `/accounts/${enc(address)}`);
  },
};
