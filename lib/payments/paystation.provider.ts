import type {
  CheckResult,
  PaymentProvider,
  PaymentState,
  StartInput,
  StartResult,
} from "./types";
import { logger } from "@/lib/log";

/**
 * PayStation (paystation.com.bd): hosted checkout plus a status lookup.
 *
 * What the docs say and what the sandbox showed (2026-10-28) differ in places,
 * and the code follows the sandbox:
 *  - a paid invoice reports `trx_status: "successful"` (the docs say
 *    "success"), so any spelling starting with "success" counts as paid;
 *  - a cancelled or declined checkout still reports "processing": only a
 *    success means anything, and "not paid yet" is the honest reading of the
 *    rest;
 *  - amounts come back as strings ("25.00"); `invoice_number` may contain
 *    letters and hyphens; codes are 1008 duplicate invoice, 1001 bad
 *    credentials, 2001 unknown invoice — all with HTTP 200;
 *  - the customer comes back with a GET to `callback_url` + `?status=
 *    Successful|Failed|Canceled&invoice_number=…&trx_id=…`, so the callback
 *    URL itself must carry no query string;
 *  - `/v2/transaction-status` answered "Server Error" in the sandbox, so only
 *    the v1 lookup by invoice number is used.
 *
 * The IPN is unsigned and sent for successes only. It is read for the invoice
 * number and nothing else; the state always comes from `check`.
 */

const BASE_URL = {
  live: "https://api.paystation.com.bd",
  sandbox: "https://sandbox.paystation.com.bd",
} as const;

/** Never wait on the gateway longer than this inside a request. */
const TIMEOUT_MS = 15_000;

export type PaystationConfig = {
  merchantId: string;
  password: string;
  env: "live" | "sandbox";
  baseUrl: string;
};

/**
 * Read the credentials from env, refusing anything half-configured.
 *
 * Production refuses the sandbox: PayStation's public sandbox accepts test
 * cards, so a production site pointed at it would hand out real goods for
 * fake payments.
 */
export function paystationConfig(): PaystationConfig {
  const merchantId = process.env.PAYSTATION_MERCHANT_ID?.trim() ?? "";
  const password = process.env.PAYSTATION_PASSWORD ?? "";
  const raw = process.env.PAYSTATION_ENV?.trim().toLowerCase();
  const env: "live" | "sandbox" =
    raw === "live" || raw === "sandbox"
      ? raw
      : process.env.NODE_ENV === "production"
        ? "live"
        : "sandbox";
  if (raw && raw !== "live" && raw !== "sandbox") {
    throw new Error(`PAYSTATION_ENV="${raw}" must be "live" or "sandbox".`);
  }
  if (!merchantId || !password) {
    throw new Error(
      "PayStation is selected but PAYSTATION_MERCHANT_ID / PAYSTATION_PASSWORD are not set.",
    );
  }
  if (env === "sandbox" && process.env.NODE_ENV === "production") {
    throw new Error(
      'PAYSTATION_ENV="sandbox" refuses to run in production: test cards would buy real goods.',
    );
  }
  return { merchantId, password, env, baseUrl: BASE_URL[env] };
}

/** "25.00" / 25 / "1,250.50" → poisha; null when absent or unreadable. */
export function toMinorAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v !== "string") return null;
  const clean = v.replace(/,/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Fold the gateway's spellings onto our states. */
export function stateOf(trxStatus: unknown): PaymentState {
  const s = typeof trxStatus === "string" ? trxStatus.trim().toLowerCase() : "";
  if (s.startsWith("success")) return "paid";
  if (s.startsWith("fail")) return "failed";
  if (s.startsWith("refund")) return "refunded";
  return "pending";
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

async function postForm(
  url: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === "object")
      return json as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new Error(
    `PayStation answered ${res.status} with something that is not JSON`,
  );
}

export function createPaystationProvider(
  config: PaystationConfig,
): PaymentProvider {
  return {
    name: "paystation",
    online: true,
    mode: config.env,

    async start(input: StartInput): Promise<StartResult> {
      if (input.amountMinor <= 0 || input.amountMinor % 100 !== 0) {
        // Rounding happens before this point; reaching here is a bug.
        throw new Error(
          `PayStation takes whole taka; got ${input.amountMinor} poisha`,
        );
      }
      const fields: Record<string, string> = {
        merchantId: config.merchantId,
        password: config.password,
        invoice_number: input.invoiceNumber,
        currency: "BDT",
        payment_amount: String(input.amountMinor / 100),
        // The company bears the fee (owner's decision, 2026-10-28).
        pay_with_charge: "0",
        reference: input.reference.slice(0, 100),
        cust_name: input.customer.name.slice(0, 100) || "Customer",
        cust_phone: input.customer.phone.slice(0, 30),
        cust_email: input.customer.email,
        callback_url: input.callbackUrl,
        checkout_items: input.description.slice(0, 250),
      };
      if (input.customer.address) {
        fields.cust_address = input.customer.address.slice(0, 250);
      }
      if (input.emi) fields.emi = "1";

      let json: Record<string, unknown>;
      try {
        json = await postForm(`${config.baseUrl}/initiate-payment`, fields);
      } catch (e) {
        // The password is in the request body; log only what went wrong.
        logger.error(
          `PayStation initiate failed for ${input.invoiceNumber}: ${e instanceof Error ? e.message : String(e)}`,
        );
        return { ok: false, reason: "unreachable" };
      }

      const code = String(json.status_code ?? "");
      const url = str(json.payment_url);
      if (code === "200" && url)
        return { ok: true, paymentUrl: url, raw: json };
      if (code === "1008") return { ok: false, reason: "duplicate_invoice" };
      if (code === "1001") return { ok: false, reason: "bad_credentials" };
      return {
        ok: false,
        reason: "refused",
        detail: `${code} ${str(json.message) ?? ""}`.trim(),
      };
    },

    async check(invoiceNumber: string): Promise<CheckResult> {
      const json = await postForm(
        `${config.baseUrl}/transaction-status`,
        { invoice_number: invoiceNumber },
        { merchantId: config.merchantId },
      );
      const code = String(json.status_code ?? "");
      if (code === "2001") {
        return { state: "unknown", amountMinor: null, raw: json };
      }
      if (code !== "200") {
        throw new Error(
          `PayStation status lookup refused: ${code} ${str(json.message) ?? ""}`.trim(),
        );
      }
      const data = (json.data ?? {}) as Record<string, unknown>;
      const state = stateOf(data.trx_status);
      return {
        state,
        amountMinor:
          toMinorAmount(data.payment_amount) ??
          toMinorAmount(data.request_amount),
        trxId: str(data.trx_id),
        method: str(data.payment_method),
        payerMobile: str(data.payer_mobile_no),
        raw: json,
      };
    },

    async readNotification(req: Request): Promise<string | null> {
      let text = "";
      try {
        text = await req.text();
      } catch {
        return null;
      }
      if (text.length > 10_000) return null;
      let invoice: unknown;
      try {
        invoice = (JSON.parse(text) as Record<string, unknown>)?.invoice_number;
      } catch {
        invoice = new URLSearchParams(text).get("invoice_number");
      }
      return typeof invoice === "string" && invoice.trim()
        ? invoice.trim().slice(0, 80)
        : null;
    },
  };
}
