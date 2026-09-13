// mail-provisioner — the one way the Spiber Med app creates mailboxes.
//
// A ~150-line HTTP service that sits next to docker-mailserver in the Coolify
// "mail" stack with ONLY the `dms-config` volume mounted (no docker socket,
// no mail data), and answers to a single bearer secret. It appends to the
// same flat files `setup email add` writes; DMS notices and reloads.
//
//   GET    /health
//   GET    /accounts                         → { accounts: [{address, quota}] }
//   GET    /accounts/:address                → { address, quota } | 404
//   PUT    /accounts/:address                { password, quota? } → 201 | 409
//   PUT    /accounts/:address/password       { password } → 204 | 404
//   PUT    /accounts/:address/quota          { quota } → 204 | 404
//   DELETE /accounts/:address                → 204 | 404
//
// Env: PROVISIONER_SECRET (required), DMS_CONFIG_DIR (default
// /tmp/docker-mailserver), PORT (default 8025), MAIL_DOMAIN (optional — when
// set, only addresses on that domain are accepted).
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { AccountsStore, isAddress, isQuota } from "./accounts.mjs";

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

/**
 * @param {{ store: AccountsStore; secret: string; domain?: string | null }} deps
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>}
 */
export function createHandler({ store, secret, domain = null }) {
  const expected = Buffer.from(secret);

  function authorised(req) {
    const h = req.headers.authorization ?? "";
    if (!h.startsWith("Bearer ")) return false;
    const got = Buffer.from(h.slice(7));
    return got.length === expected.length && timingSafeEqual(got, expected);
  }

  function send(res, status, body) {
    if (body === undefined) {
      res.writeHead(status);
      res.end();
      return;
    }
    const json = JSON.stringify(body);
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(json),
    });
    res.end(json);
  }

  async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 16 * 1024) throw new Error("body too large");
      chunks.push(c);
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  const validPassword = (p) =>
    typeof p === "string" &&
    p.length >= PASSWORD_MIN &&
    p.length <= PASSWORD_MAX &&
    !/[\r\n|]/.test(p);

  return async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true });
    }
    if (!authorised(req)) return send(res, 401, { error: "unauthorised" });

    const m = url.pathname.match(
      /^\/accounts(?:\/([^/]+)(?:\/(password|quota))?)?$/,
    );
    if (!m) return send(res, 404, { error: "not_found" });
    const address = m[1] ? decodeURIComponent(m[1]).toLowerCase() : null;
    const sub = m[2] ?? null;

    if (address !== null) {
      if (!isAddress(address)) return send(res, 400, { error: "bad_address" });
      if (domain && !address.endsWith(`@${domain}`)) {
        return send(res, 400, { error: "wrong_domain" });
      }
    }

    try {
      if (req.method === "GET" && address === null) {
        return send(res, 200, { accounts: await store.list() });
      }
      if (req.method === "GET" && sub === null) {
        const acc = await store.get(address);
        return acc
          ? send(res, 200, acc)
          : send(res, 404, { error: "not_found" });
      }
      if (req.method === "PUT" && sub === null) {
        const body = await readJson(req);
        if (!validPassword(body.password)) {
          return send(res, 400, { error: "bad_password" });
        }
        if (body.quota !== undefined && !isQuota(body.quota)) {
          return send(res, 400, { error: "bad_quota" });
        }
        const created = await store.create(address, body.password, body.quota);
        return created
          ? send(res, 201, { address, quota: body.quota ?? null })
          : send(res, 409, { error: "exists" });
      }
      if (req.method === "PUT" && sub === "password") {
        const body = await readJson(req);
        if (!validPassword(body.password)) {
          return send(res, 400, { error: "bad_password" });
        }
        const ok = await store.setPassword(address, body.password);
        return ok ? send(res, 204) : send(res, 404, { error: "not_found" });
      }
      if (req.method === "PUT" && sub === "quota") {
        const body = await readJson(req);
        if (!isQuota(body.quota)) return send(res, 400, { error: "bad_quota" });
        const ok = await store.setQuota(address, body.quota);
        return ok ? send(res, 204) : send(res, 404, { error: "not_found" });
      }
      if (req.method === "DELETE" && sub === null) {
        const ok = await store.remove(address);
        return ok ? send(res, 204) : send(res, 404, { error: "not_found" });
      }
      return send(res, 405, { error: "method_not_allowed" });
    } catch (e) {
      const bad = e instanceof SyntaxError || /body too large/.test(String(e));
      console.error(
        new Date().toISOString(),
        req.method,
        url.pathname,
        String(e),
      );
      return send(res, bad ? 400 : 500, {
        error: bad ? "bad_json" : "internal",
      });
    }
  };
}

// Entry point (skipped when imported by tests).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const secret = process.env.PROVISIONER_SECRET;
  if (!secret || secret.length < 32) {
    console.error("PROVISIONER_SECRET must be set (32+ chars)");
    process.exit(1);
  }
  const store = new AccountsStore(
    process.env.DMS_CONFIG_DIR || "/tmp/docker-mailserver",
  );
  const handler = createHandler({
    store,
    secret,
    domain: process.env.MAIL_DOMAIN || null,
  });
  const port = Number(process.env.PORT || 8025);
  http.createServer(handler).listen(port, "0.0.0.0", () => {
    console.log(`mail-provisioner listening on :${port}`);
  });
}
