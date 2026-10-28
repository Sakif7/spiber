import type { PaymentProviderName } from "@/lib/schemas/order";

/** Who is paying, as the gateway's checkout page needs them. */
export type PaymentCustomer = {
  name: string;
  phone: string;
  email: string;
  address?: string;
};

/** Hand one attempt to the gateway. */
export type StartInput = {
  /** Unique per try; the gateway refuses a reused one. */
  invoiceNumber: string;
  /** Whole taka, in poisha. */
  amountMinor: number;
  customer: PaymentCustomer;
  /** Our own reference (order number…), shown in the gateway's panel. */
  reference: string;
  /** A line describing what is being paid for. */
  description: string;
  /**
   * Where the gateway sends the customer back, paid or not. Must carry no
   * query string: PayStation appends its own with a `?`.
   */
  callbackUrl: string;
  /** Offer instalments (PayStation: from ৳5,000). */
  emi?: boolean;
};

export type StartResult =
  | { ok: true; paymentUrl: string; raw?: unknown }
  | {
      ok: false;
      reason:
        | "duplicate_invoice"
        | "bad_credentials"
        | "refused"
        | "unreachable";
      detail?: string;
    };

/**
 * What the gateway says about one invoice.
 *
 *  pending  created and not paid — PayStation reports a cancelled or a
 *           declined checkout this way too, so it never means "failed"
 *  paid     the money was taken
 *  failed   the gateway itself says it failed
 *  refunded the gateway refunded it
 *  unknown  it has never heard of the invoice
 */
export type PaymentState =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "unknown";

export type CheckResult = {
  state: PaymentState;
  /** What the gateway took (paid) or was asked for, in poisha; null if absent. */
  amountMinor: number | null;
  trxId?: string;
  method?: string;
  payerMobile?: string;
  paidAt?: Date;
  raw: unknown;
};

/**
 * Pluggable payment provider.
 *
 * `manual` is the offline arrangement: it takes no money and an admin marks
 * things paid. An online gateway starts a payment and answers status
 * questions. Nothing a gateway sends us is ever trusted on its own: a callback
 * only names an invoice, and the state is always asked of the gateway again
 * (`check`) over our own connection to it.
 */
export interface PaymentProvider {
  name: PaymentProviderName;
  /** True when this provider actually collects money online. */
  online: boolean;
  /** live | sandbox | dev — recorded on every attempt. */
  mode: "live" | "sandbox" | "dev" | "offline";
  start?(input: StartInput): Promise<StartResult>;
  /** Throws when the gateway cannot be reached, so callers can retry. */
  check?(invoiceNumber: string): Promise<CheckResult>;
  /**
   * Read which invoice a server-to-server notification is about. Returns null
   * for anything unreadable. Never trusted for state or amount.
   */
  readNotification?(req: Request): Promise<string | null>;
}
