import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Order, type IOrder } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import { getOrderByNumber } from "@/lib/repositories/orders.repo";
import {
  attemptsForSubject,
  claimAttempt,
  createAttempt,
  dueOpenAttempts,
  getAttemptByInvoice,
  recordCheck,
  type LeanAttempt,
} from "@/lib/repositories/payment-attempts.repo";
import { paymentProviderStatus, type PaymentProvider } from "@/lib/payments";
import type { PaymentCustomer } from "@/lib/payments/types";
import { feeFor } from "@/lib/payments/fees";
import {
  placeOrder,
  recordOrderPayment,
  transitionOrder,
} from "./order.service";
import { transitionPurchase } from "./software.service";
import { transitionEnrollment } from "./enrollment.service";
import { recordOnlinePayment } from "./sales-order.service";
import { onlinePointAvailable } from "./payment-availability";
import { SoftwarePurchase } from "@/lib/models/softwarePurchase";
import { Enrollment } from "@/lib/models/enrollment";
import type { IPaymentAttempt } from "@/lib/models/payment-attempt";
import { findUserById } from "@/lib/repositories/users.repo";
import {
  addSalesOrderActivity,
  getSalesOrderById,
} from "@/lib/repositories/sales.repo";
import {
  getRequestById,
  markRequestPaid,
} from "@/lib/repositories/payment-requests.repo";
import { linkBasisOf, withholdingOnRecord } from "@/lib/sales/payment-link";
import {
  addTourismActivity,
  confirmIfQuoted,
  loadTourismSubject,
  recordTourismPayment,
  type TourismKind,
} from "@/lib/repositories/tourism-payments.repo";
import { sendTourismReceipt } from "./tourism-payment.service";
import {
  getPaymentSettings,
  isPaymentPointOn,
} from "./payment-settings.service";
import type { CartOwner } from "@/lib/repositories/cart.repo";
import { PAYMENT_HOLD_MINUTES, type CheckoutInput } from "@/lib/schemas/order";
import {
  EMI_MIN_MINOR,
  MAX_OPEN_BILL_ATTEMPTS,
  MAX_ORDER_ATTEMPTS,
  type PaymentCheckVia,
  type PaymentIssue,
  type PaymentPoint,
  type PaymentSubjectKind,
} from "@/lib/schemas/payment";
import { notifyAdmins, notifySuperAdmins } from "./notification.service";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { makeId } from "@/lib/ids";
import { logger } from "@/lib/log";

/**
 * Online payment through the gateway (PayStation; `dev` locally).
 *
 * Every try is a PaymentAttempt with its own invoice number. Whatever tells us
 * something happened — the gateway's notification, the customer coming back,
 * the sweeper, an admin pressing Re-check — only names an invoice; the state
 * and the amount are always asked of the gateway again (`confirmAttempt`),
 * and a conditional write on the attempt decides which of them applies it.
 * So a payment is applied exactly once, for exactly what was asked, however
 * many of those arrive and in whatever order.
 */

type Storefront = "instruments" | "marketplace";
type LeanOrder = Lean<IOrder>;

const POINT_OF: Record<Storefront, PaymentPoint> = {
  instruments: "medtrade",
  marketplace: "kart",
};

const STOREFRONT_PATH: Record<Storefront, string> = {
  instruments: "/medtrade",
  marketplace: "/kart",
};

/** First look at a new attempt; the customer is usually back long before. */
const FIRST_LOOK_MS = 2 * 60_000;
/** The sweeper runs every 5 minutes; asking "in 4" lands on the next run. */
const EVERY_RUN_MS = 4 * 60_000;
const HOURLY_MS = 55 * 60_000;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * When to ask about a still-unpaid attempt again: every sweeper run for its
 * first hour, hourly for a day, then never (null = give up).
 */
export function nextLookAt(createdAt: Date, now: Date): Date | null {
  const age = now.getTime() - createdAt.getTime();
  if (age < HOUR_MS) return new Date(now.getTime() + EVERY_RUN_MS);
  if (age < DAY_MS) return new Date(now.getTime() + HOURLY_MS);
  return null;
}

/** "SPMP-LZ4K…-0Q2X9" — ours, unique per try, letters and hyphens allowed. */
const newInvoiceNumber = (): string => makeId("SPMP");

/** No query string of our own: PayStation appends its own with a "?". */
const callbackUrl = (invoiceNumber: string): string =>
  `${siteConfig.url}/api/payments/return/${encodeURIComponent(invoiceNumber)}`;

/** English is served without a prefix (localePrefix "as-needed"). */
function localized(locale: string | null | undefined, path: string): string {
  return locale && locale !== "en" ? `/${locale}${path}` : path;
}

/** The gateway that can take money right now, or null. */
export function onlineProvider(): PaymentProvider | null {
  const s = paymentProviderStatus();
  return s.ok && s.provider.online && s.provider.start && s.provider.check
    ? s.provider
    : null;
}

/** Is paying now offered at this storefront's checkout? */
export async function onlinePaymentAvailable(
  storefront: Storefront,
): Promise<boolean> {
  if (!onlineProvider()) return false;
  return isPaymentPointOn(POINT_OF[storefront]);
}

// ───────────────────────────── starting a payment ─────────────────────────────

export type StartPaymentResult =
  | { ok: true; redirectUrl: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_payable"
        | "expired"
        | "too_many_attempts"
        | "unavailable"
        | "start_failed";
    };

/**
 * Hand an order paid online to the gateway: at checkout, and again from the
 * order page ("Pay again") while its stock is still held.
 *
 * Each try takes one slot on the order in a single conditional write — which
 * also (re)starts the 30-minute hold — so two quick clicks cannot exceed the
 * limit, and a try is never started on an order whose hold has run out.
 */
export async function startOrderPayment(
  orderId: string,
  opts: { locale?: string | null } = {},
): Promise<StartPaymentResult> {
  if (!mongoose.isValidObjectId(orderId))
    return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const order = await Order.findById(orderId).lean<LeanOrder>().exec();
  if (!order) return { ok: false, reason: "not_found" };
  if (
    order.status !== "pending" ||
    (order.payment.method ?? "offline") !== "online" ||
    order.payment.status === "paid"
  ) {
    return { ok: false, reason: "not_payable" };
  }
  const provider = onlineProvider();
  if (!provider || !(await isPaymentPointOn(POINT_OF[order.storefront]))) {
    return { ok: false, reason: "unavailable" };
  }

  const now = new Date();
  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "pending",
      "payment.status": { $in: ["unpaid", "initiated", "failed"] },
      $and: [
        {
          $or: [
            { "payment.attempts": { $exists: false } },
            { "payment.attempts": { $lt: MAX_ORDER_ATTEMPTS } },
          ],
        },
        // The first try comes from checkout with no hold yet; a later one
        // only while the hold is still running.
        {
          $or: [
            { "payment.expiresAt": null },
            { "payment.expiresAt": { $gt: now } },
          ],
        },
      ],
    },
    {
      $inc: { "payment.attempts": 1 },
      $set: {
        "payment.provider": provider.name,
        "payment.status": "initiated",
        "payment.initiatedAt": now,
        "payment.expiresAt": new Date(
          now.getTime() + PAYMENT_HOLD_MINUTES * 60_000,
        ),
      },
    },
    { returnDocument: "after" },
  )
    .lean<LeanOrder>()
    .exec();
  if (!claimed) {
    const tries = order.payment.attempts ?? 0;
    if (tries >= MAX_ORDER_ATTEMPTS)
      return { ok: false, reason: "too_many_attempts" };
    return { ok: false, reason: "expired" };
  }

  // Whole taka: new orders are already rounded; one placed before rounding
  // existed drops its poisha here, and the attempt says so.
  const amountMinor = wholeTaka(claimed.totalMinor);
  if (amountMinor <= 0) return { ok: false, reason: "not_payable" };
  return beginAttempt({
    provider,
    subject: {
      kind: "order",
      id: claimed._id as mongoose.Types.ObjectId,
      ref: claimed.orderNumber,
    },
    amountMinor,
    roundingMinor: amountMinor - claimed.totalMinor,
    customer: orderCustomer(claimed),
    reference: claimed.orderNumber,
    description: orderDescription(claimed),
    locale: opts.locale,
  });
}

/** Drop the poisha: the gateway takes whole taka. */
const wholeTaka = (minor: number): number => minor - (minor % 100);

/** The order's buyer, as the gateway's checkout page needs them. */
function orderCustomer(order: LeanOrder): PaymentCustomer {
  const a = order.shippingAddress;
  return {
    name: a.label?.trim() || order.email.split("@")[0] || "Customer",
    phone: a.phone,
    email: order.email,
    address: [a.line1, a.city, a.district].filter(Boolean).join(", "),
  };
}

function orderDescription(order: LeanOrder): string {
  const items = order.items.reduce((n, it) => n + it.qty, 0);
  return `${order.storefront === "instruments" ? "Medtrade" : "Spiber Kart"} order ${order.orderNumber} · ${items} item${items === 1 ? "" : "s"}`;
}

/** Everything one try at the gateway needs, whatever it pays for. */
export type AttemptStart = {
  provider: PaymentProvider;
  subject: IPaymentAttempt["subject"];
  /** Whole taka, in poisha. */
  amountMinor: number;
  /** Poisha dropped when the thing itself was not whole taka (0 to −99). */
  roundingMinor?: number;
  customer: PaymentCustomer;
  /** Ours, shown in the gateway's panel: the order or invoice number. */
  reference: string;
  description: string;
  locale?: string | null;
  /** The pay link it was started from. */
  requestId?: mongoose.Types.ObjectId | null;
};

/**
 * Open an attempt and hand it to the gateway — the one place a try starts.
 * A refusal marks the attempt failed (there is nothing to ask about later)
 * and answers `start_failed`.
 */
export async function beginAttempt(
  s: AttemptStart,
): Promise<StartPaymentResult> {
  const now = new Date();
  const settings = await getPaymentSettings();
  const invoiceNumber = newInvoiceNumber();
  const attempt = await createAttempt({
    invoiceNumber,
    provider: s.provider.name,
    mode: s.provider.mode,
    subject: s.subject,
    amountMinor: s.amountMinor,
    roundingMinor: s.roundingMinor || undefined,
    status: "open",
    locale: s.locale ?? null,
    nextCheckAt: new Date(now.getTime() + FIRST_LOOK_MS),
    requestId: s.requestId ?? null,
  });

  const started = await s.provider.start!({
    invoiceNumber,
    amountMinor: s.amountMinor,
    customer: s.customer,
    reference: s.reference,
    description: s.description,
    callbackUrl: callbackUrl(invoiceNumber),
    emi: settings.emi && s.amountMinor >= EMI_MIN_MINOR,
  });

  if (!started.ok) {
    logger.error(
      `payment start refused for ${s.subject.ref} (${invoiceNumber}): ${started.reason} ${started.detail ?? ""}`,
    );
    await recordCheck(
      attempt._id,
      { at: now, via: "start", state: "error", raw: started },
      { status: "failed", nextCheckAt: null },
    );
    return { ok: false, reason: "start_failed" };
  }
  await recordCheck(
    attempt._id,
    { at: now, via: "start", state: "pending", raw: started.raw ?? null },
    { paymentUrl: started.paymentUrl },
  );
  return { ok: true, redirectUrl: started.paymentUrl };
}

export type CheckoutResult =
  | { ok: true; order: IOrder; redirectUrl?: string }
  | {
      ok: false;
      code:
        | "empty_cart"
        | "out_of_stock"
        | "product_unavailable"
        | "credit_not_available"
        | "invalid_payment_method"
        | "payment_unavailable";
    };

/**
 * Place an order and, when it is to be paid online, start the payment.
 *
 * Online is refused before anything is placed when the gateway or this
 * storefront's switch is off. If the gateway will not start, the order is
 * cancelled straight away: the customer never saw a confirmation, and an
 * order nobody can pay would otherwise sit on its reserved stock.
 */
export async function placeAndPay(
  input: CheckoutInput,
  owner: CartOwner,
  userId: string | undefined,
  storefront: Storefront,
): Promise<CheckoutResult> {
  if (
    input.paymentMethod === "online" &&
    !(await onlinePaymentAvailable(storefront))
  ) {
    return { ok: false, code: "payment_unavailable" };
  }
  const placed = await placeOrder(input, owner, userId, storefront);
  if (!placed.ok) return placed;

  const { order, orderId } = placed;
  if ((order.payment.method ?? "offline") !== "online") {
    return { ok: true, order };
  }

  // The same checkout submitted twice (idempotency key): send the customer to
  // the try already running rather than starting another.
  if (order.payment.status === "initiated") {
    const open = (await attemptsForSubject("order", orderId)).find(
      (a) => a.status === "open" && a.paymentUrl,
    );
    if (open?.paymentUrl)
      return { ok: true, order, redirectUrl: open.paymentUrl };
  }

  const started = await startOrderPayment(orderId, { locale: input.locale });
  if (started.ok) return { ok: true, order, redirectUrl: started.redirectUrl };

  logger.error(
    `could not start payment for ${order.orderNumber}: ${started.reason}`,
  );
  await transitionOrder(orderId, "cancelled", {
    internalNote: `Online payment could not be started (${started.reason}); stock released.`,
    silent: true,
  }).catch((e) => logger.error("could not cancel unpayable order", e));
  return { ok: false, code: "payment_unavailable" };
}

/**
 * Paying from the order page: "Pay again" on an online order whose payment
 * did not go through, or "Pay now" on a credit / COD order still owed. A
 * guest proves the order is theirs with its email, exactly like the order
 * lookup; a signed-in owner needs nothing more.
 */
export async function payOrderAgain(
  orderNumber: string,
  who: { userId?: string | null; email?: string | null },
  locale?: string | null,
): Promise<StartPaymentResult> {
  const order = await getOrderByNumber(orderNumber);
  if (!order) return { ok: false, reason: "not_found" };
  const ownsBySession =
    !!who.userId && String(order.userId ?? "") === who.userId;
  const ownsByEmail =
    !!who.email && order.email === who.email.trim().toLowerCase();
  if (!ownsBySession && !ownsByEmail) return { ok: false, reason: "not_found" };
  const method = order.payment.method ?? "offline";
  if (method === "cod" || method === "credit") {
    return startOrderDuePayment(String(order._id), { locale });
  }
  return startOrderPayment(String(order._id), { locale });
}

/**
 * Can this credit / COD order be paid online now? Still owed (unpaid, not
 * cancelled or refunded), something to pay, and the door switched on.
 *
 * A delivered COD order is not: the courier took the cash at the door, and
 * it is only waiting for someone to record that — paying online then would
 * pay twice. A delivered credit order is exactly when its invoice falls due.
 */
export async function orderDuePayable(
  order: Pick<LeanOrder, "status" | "payment" | "totalMinor">,
): Promise<boolean> {
  const method = order.payment.method ?? "offline";
  if (method !== "cod" && method !== "credit") return false;
  if (order.payment.status !== "unpaid") return false;
  if (order.status === "cancelled" || order.status === "refunded") return false;
  if (method === "cod" && order.status === "delivered") return false;
  if (wholeTaka(order.totalMinor) <= 0) return false;
  return onlinePointAvailable("order_due");
}

/**
 * "Pay now" on a credit / COD order: a fresh try at the gateway for what is
 * owed. Nothing is held, so the order is not touched until the money is
 * confirmed — then it is recorded as paid, exactly like a payment taken by
 * hand (`recordOrderPayment`), and the courier is told not to collect.
 */
export async function startOrderDuePayment(
  orderId: string,
  opts: { locale?: string | null } = {},
): Promise<StartPaymentResult> {
  if (!mongoose.isValidObjectId(orderId))
    return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const order = await Order.findById(orderId).lean<LeanOrder>().exec();
  if (!order) return { ok: false, reason: "not_found" };
  if (!(await orderDuePayable(order))) {
    const off = !(await onlinePointAvailable("order_due"));
    return { ok: false, reason: off ? "unavailable" : "not_payable" };
  }
  const provider = onlineProvider();
  if (!provider) return { ok: false, reason: "unavailable" };
  const prior = await attemptsForSubject("order_due", orderId);
  if (prior.length >= MAX_OPEN_BILL_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }
  // An order placed before rounding may still carry poisha: charge the taka.
  const amountMinor = wholeTaka(order.totalMinor);
  return beginAttempt({
    provider,
    subject: {
      kind: "order_due",
      id: order._id as mongoose.Types.ObjectId,
      ref: order.orderNumber,
    },
    amountMinor,
    roundingMinor: amountMinor - order.totalMinor,
    customer: orderCustomer(order),
    reference: order.orderNumber,
    description: orderDescription(order),
    locale: opts.locale,
  });
}

// ───────────────────────────── confirming a payment ─────────────────────────────

export type ConfirmResult =
  | "paid"
  | "pending"
  | "failed"
  | "needs_refund"
  | "already"
  | "unknown";

export type ConfirmOutcome = {
  result: ConfirmResult;
  attempt: LeanAttempt | null;
};

/**
 * Ask the gateway about one invoice and apply what it says — the one function
 * the notification, the customer's return, the sweeper and an admin's
 * Re-check all go through. Throws only when the gateway cannot be reached
 * (the notification then answers 500 so PayStation tries again).
 */
export async function confirmAttempt(
  invoiceNumber: string,
  via: PaymentCheckVia,
  now: Date = new Date(),
): Promise<ConfirmOutcome> {
  const attempt = await getAttemptByInvoice(invoiceNumber);
  if (!attempt) return { result: "unknown", attempt: null };
  // Only an open try can still turn into money; an abandoned one is asked
  // again when someone asks explicitly, in case it was paid late.
  if (attempt.status !== "open" && attempt.status !== "abandoned") {
    return { result: "already", attempt };
  }

  const provider = onlineProvider();
  if (!provider || provider.name !== attempt.provider) {
    // Started on another gateway (or the gateway is switched off): nothing
    // can be asked now. Look again in an hour, give up after a day.
    if (attempt.status === "open") {
      const next = nextLookAt(new Date(attempt.createdAt), now);
      await claimAttempt(
        attempt._id,
        ["open"],
        next
          ? { nextCheckAt: new Date(now.getTime() + HOURLY_MS) }
          : { status: "abandoned", nextCheckAt: null },
      );
    }
    return { result: "pending", attempt };
  }

  const check = await provider.check!(invoiceNumber);

  if (check.state !== "paid") {
    const set: Record<string, unknown> = {};
    if (check.state === "failed") {
      set.status = "failed";
      set.nextCheckAt = null;
    } else if (attempt.status === "open") {
      const next = nextLookAt(new Date(attempt.createdAt), now);
      if (next) set.nextCheckAt = next;
      else {
        set.status = "abandoned";
        set.nextCheckAt = null;
      }
    }
    await recordCheck(
      attempt._id,
      { at: now, via, state: check.state, raw: check.raw },
      set,
    );
    return {
      result: check.state === "failed" ? "failed" : "pending",
      attempt: { ...attempt, ...set } as LeanAttempt,
    };
  }

  // Paid at the gateway. Freeze what it took and what it cost us.
  const paidMinor = check.amountMinor ?? attempt.amountMinor;
  const settings = await getPaymentSettings();
  const fee = feeFor(paidMinor, check.method, now, settings.feeRates);
  const paid = {
    trxId: check.trxId ?? null,
    method: check.method ?? null,
    payerMobile: check.payerMobile ?? null,
    paidMinor,
    paidAt: now,
    feeMinor: fee?.feeMinor ?? null,
    feeRateBp: fee?.rateBp ?? null,
    nextCheckAt: null,
  };
  const amountOk = paidMinor === attempt.amountMinor;
  const claimed = await claimAttempt(attempt._id, ["open", "abandoned"], {
    ...paid,
    ...(amountOk
      ? { status: "paid" }
      : { status: "needs_refund", issue: "amount_mismatch" }),
  });
  await recordCheck(attempt._id, {
    at: now,
    via,
    state: "paid",
    raw: check.raw,
  });
  if (!claimed) {
    // Another caller got there first and applied it (or flagged it).
    const fresh = await getAttemptByInvoice(invoiceNumber);
    return { result: "already", attempt: fresh };
  }
  if (!amountOk) {
    await alertRefund(claimed, "amount_mismatch");
    return { result: "needs_refund", attempt: claimed };
  }

  const applied = await applyToSubject(claimed);
  if (!applied.ok) {
    const flagged =
      (await claimAttempt(claimed._id, ["paid"], {
        status: "needs_refund",
        issue: applied.issue,
      })) ?? claimed;
    await alertRefund(flagged, applied.issue);
    return { result: "needs_refund", attempt: flagged };
  }
  return { result: "paid", attempt: claimed };
}

type Applied = { ok: true } | { ok: false; issue: PaymentIssue };

/** Apply a confirmed payment to what it paid for. */
async function applyToSubject(attempt: LeanAttempt): Promise<Applied> {
  switch (attempt.subject.kind) {
    case "order":
      return applyToOrder(attempt);
    case "order_due":
      return applyToOrderDue(attempt);
    case "software":
      return applyToDigital(attempt, "software");
    case "enrollment":
      return applyToDigital(attempt, "enrollment");
    case "sales_order":
      return applyToSalesOrder(attempt);
    case "medical_case":
    case "travel_request":
      return applyToTourism(attempt, attempt.subject.kind);
    default:
      // A kind whose handler is not built yet must never swallow money.
      logger.error(`no payment handler for ${attempt.subject.kind}`);
      return { ok: false, issue: "late" };
  }
}

/**
 * A software purchase or a course: pending → paid/active, which runs the
 * delivery (download, licence) or opens the course. Retried while it is still
 * pending, like an order; anything else means the money came twice or late.
 */
async function applyToDigital(
  attempt: LeanAttempt,
  kind: DigitalKind,
): Promise<Applied> {
  const id = String(attempt.subject.id);
  const read = () =>
    kind === "software"
      ? SoftwarePurchase.findById(id)
          .select({ status: 1 })
          .lean<{ status: string }>()
          .exec()
      : Enrollment.findById(id)
          .select({ status: 1 })
          .lean<{ status: string }>()
          .exec();
  const payment = {
    provider: attempt.provider,
    txnId: attempt.trxId ?? attempt.invoiceNumber,
  };
  const note = `Payment received${attempt.method ? ` · ${attempt.method}` : ""}`;
  let current = await read();
  for (let i = 0; i < 3 && current?.status === "pending"; i++) {
    const moved =
      kind === "software"
        ? await transitionPurchase(id, "paid", { note, payment })
        : await transitionEnrollment(id, "active", { note, payment });
    if (moved.ok) return { ok: true };
    current = await read();
  }
  if (!current) return { ok: false, issue: "late" };
  return {
    ok: false,
    issue:
      current.status === "paid" || current.status === "active"
        ? "duplicate"
        : "late",
  };
}

async function applyToOrder(attempt: LeanAttempt): Promise<Applied> {
  const id = String(attempt.subject.id);
  const order = await Order.findById(id).lean<LeanOrder>().exec();
  if (!order) return { ok: false, issue: "late" };

  // transitionOrder writes only if the order is exactly as it read it, so a
  // customer pressing "Pay again" at the same instant (which touches the
  // payment fields) makes it miss once — read again and retry while the order
  // is still pending and unpaid.
  let current: LeanOrder | null = order;
  for (let i = 0; i < 3 && current; i++) {
    if (current.status !== "pending" || current.payment.status === "paid")
      break;
    const moved = await transitionOrder(id, "paid", {
      note: "Payment received",
      internalNote: `${attempt.provider} · ${attempt.trxId ?? attempt.invoiceNumber}${attempt.method ? ` · ${attempt.method}` : ""}`,
      payment: {
        provider: attempt.provider,
        txnId: attempt.trxId ?? attempt.invoiceNumber,
      },
    });
    if (moved.ok) return { ok: true };
    current = await Order.findById(id).lean<LeanOrder>().exec();
  }

  // It moved on before the money came: already paid (another try, or marked
  // paid by hand) means a duplicate; cancelled means it came too late. Either
  // way the money is not applied, and the order says so for whoever opens it.
  const fresh = current;
  const issue: PaymentIssue =
    fresh &&
    (fresh.payment.status === "paid" ||
      ["paid", "processing", "shipped", "delivered"].includes(fresh.status))
      ? "duplicate"
      : "late";
  await Order.updateOne(
    { _id: id },
    {
      $push: {
        timeline: {
          status: fresh?.status ?? order.status,
          at: new Date(),
          internalNote: `${formatBDT(attempt.paidMinor ?? attempt.amountMinor)} arrived online (${attempt.invoiceNumber}) after this order was ${fresh?.status ?? order.status}${issue === "duplicate" ? " and already paid" : ""}. Not applied — refund it, then record the refund under Company › Payments.`,
        },
      },
    },
  ).exec();
  return { ok: false, issue };
}

/**
 * A credit / COD order paid online later: recorded as paid exactly like money
 * taken by hand — the status stays where it is, and the order, the customer's
 * email and the invoice sheet say not to collect on delivery. One
 * conditional write, so an admin recording cash at the same moment cannot
 * also land.
 */
async function applyToOrderDue(attempt: LeanAttempt): Promise<Applied> {
  const id = String(attempt.subject.id);
  const trx = attempt.trxId ?? attempt.invoiceNumber;
  const res = await recordOrderPayment(id, {
    provider: attempt.provider,
    txnId: trx,
    note: "Paid online",
    internalNote: `${attempt.provider} · ${trx}${attempt.method ? ` · ${attempt.method}` : ""} — nothing to collect on delivery`,
  });
  if (res.ok) {
    const amount = formatBDT(attempt.paidMinor ?? attempt.amountMinor);
    await notifyAdmins({
      type: "payment.received",
      severity: "info",
      title: `Paid online — ${attempt.subject.ref}`,
      // A COD parcel may already be on its way: whoever hands it over must
      // not ask for the money again.
      body:
        res.order.payment.method === "cod"
          ? `This cash-on-delivery order was paid online (${amount}). Nothing to collect on delivery.`
          : `This credit order was paid online (${amount}); its invoice is settled.`,
      href: `/admin/orders/${id}`,
      entity: { kind: "Order", id, ref: attempt.subject.ref },
    });
    return { ok: true };
  }

  const order = await Order.findById(id).lean<LeanOrder>().exec();
  if (!order) return { ok: false, issue: "late" };
  const issue: PaymentIssue =
    order.payment.status === "paid" ? "duplicate" : "late";
  await Order.updateOne(
    { _id: id },
    {
      $push: {
        timeline: {
          status: order.status,
          at: new Date(),
          internalNote: `${formatBDT(attempt.paidMinor ?? attempt.amountMinor)} arrived online (${attempt.invoiceNumber}) after this order was ${issue === "duplicate" ? "already paid" : order.status}. Not applied — refund it, then record the refund under Company › Online payments.`,
        },
      },
    },
  ).exec();
  return { ok: false, issue };
}

/**
 * A Sales invoice paid through its pay link: the order's payment becomes
 * "online", with the transaction id as its reference and the rounding kept
 * for the report. The link closes; the super admins hear of it.
 */
async function applyToSalesOrder(attempt: LeanAttempt): Promise<Applied> {
  const id = String(attempt.subject.id);
  const paid = attempt.paidMinor ?? attempt.amountMinor;
  const trx = attempt.trxId ?? attempt.invoiceNumber;
  const at = attempt.paidAt ? new Date(attempt.paidAt) : new Date();
  // A full-total link that is paid proves the client kept nothing back.
  const [request, before] = await Promise.all([
    getRequestById(attempt.requestId),
    getSalesOrderById(id),
  ]);
  const onRecord = before ? withholdingOnRecord(before) : 0;
  const nothingWithheld =
    !!request && linkBasisOf(request) === "full" && onRecord > 0;
  const moved = await recordOnlinePayment(id, {
    paidAt: at,
    reference: trx,
    note: `${attempt.provider} · ${attempt.invoiceNumber}${attempt.method ? ` · ${attempt.method}` : ""}`,
    roundingMinor: attempt.roundingMinor ?? 0,
    body: `Paid online — ${formatBDT(paid)}${attempt.method ? ` by ${attempt.method}` : ""} (transaction ${trx})${
      nothingWithheld
        ? `. Paid in full, so AIT withheld is now ৳0 (was ${formatBDT(onRecord)})`
        : ""
    }`,
    nothingWithheld,
  });

  if (!moved) {
    const order = await getSalesOrderById(id);
    const issue: PaymentIssue =
      order?.payment.status === "paid" ? "duplicate" : "late";
    if (order) {
      await addSalesOrderActivity(id, {
        body: `${formatBDT(paid)} arrived online (${attempt.invoiceNumber}) after this order was ${issue === "duplicate" ? "already paid" : order.status.replace(/_/g, " ")}. Not applied — refund it, then record the refund under Company › Online payments.`,
      });
    }
    return { ok: false, issue };
  }

  if (attempt.requestId) {
    await markRequestPaid(attempt.requestId, attempt._id, at).catch((e) =>
      logger.warn(`could not close pay link for ${attempt.invoiceNumber}`, e),
    );
  }
  await notifySuperAdmins({
    type: "payment.received",
    severity: "info",
    title: `Paid online — ${attempt.subject.ref}`,
    body: `${moved.leadSnapshot.organisation} paid ${formatBDT(paid)}${attempt.method ? ` by ${attempt.method}` : ""} through the payment link.`,
    href: `/admin/company/sales/orders/${id}`,
    entity: { kind: "SalesOrder", id, ref: attempt.subject.ref },
  });
  return { ok: true };
}

/**
 * A tourism quote paid through its link: the payment is recorded on the case
 * or request (one conditional write — still payable, not paid already), a
 * quoted one becomes confirmed, the link closes, the team hears of it and the
 * patient gets a receipt.
 */
async function applyToTourism(
  attempt: LeanAttempt,
  kind: TourismKind,
): Promise<Applied> {
  const id = String(attempt.subject.id);
  const paid = attempt.paidMinor ?? attempt.amountMinor;
  const trx = attempt.trxId ?? attempt.invoiceNumber;
  const at = attempt.paidAt ? new Date(attempt.paidAt) : new Date();
  const applied = await recordTourismPayment(
    kind,
    id,
    {
      status: "paid",
      paidAt: at,
      amountMinor: paid,
      method: "online",
      reference: trx,
    },
    `Paid online — ${formatBDT(paid)}${attempt.method ? ` by ${attempt.method}` : ""} (transaction ${trx})`,
  );
  const s = await loadTourismSubject(kind, id);
  if (!applied) {
    const issue: PaymentIssue =
      s?.payment?.status === "paid" ? "duplicate" : "late";
    if (s) {
      await addTourismActivity(
        kind,
        id,
        `${formatBDT(paid)} arrived online (${attempt.invoiceNumber}) after this ${s.label.toLowerCase()} was ${issue === "duplicate" ? "already paid" : s.status.replace(/_/g, " ")}. Not applied — refund it, then record the refund under Company › Online payments.`,
      );
    }
    return { ok: false, issue };
  }

  await confirmIfQuoted(kind, id, "Confirmed — paid online");
  if (attempt.requestId) {
    await markRequestPaid(attempt.requestId, attempt._id, at).catch((e) =>
      logger.warn(`could not close pay link for ${attempt.invoiceNumber}`, e),
    );
  }
  if (s) {
    await Promise.allSettled([
      notifyAdmins({
        type: "payment.received",
        severity: "info",
        title: `Paid online — ${s.ref}`,
        body: `${s.customer.name} paid ${formatBDT(paid)}${attempt.method ? ` by ${attempt.method}` : ""} for ${s.label.toLowerCase()} ${s.ref}.`,
        href: s.adminHref,
        entity: {
          kind: kind === "medical_case" ? "MedicalCase" : "TravelRequest",
          id,
          ref: s.ref,
        },
      }),
      sendTourismReceipt(s, paid, trx),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected")
          logger.warn("tourism payment notice failed", r.reason);
      }
    });
  }
  return { ok: true };
}

const ISSUE_TEXT: Record<PaymentIssue, string> = {
  late: "arrived after it was cancelled",
  duplicate: "was already paid",
  amount_mismatch: "came in for the wrong amount",
  cancelled: "was cancelled after payment",
};

async function alertRefund(attempt: LeanAttempt, issue: PaymentIssue) {
  const kind = attempt.subject.kind;
  const id = String(attempt.subject.id);
  // A Sales invoice is the super admins' business only.
  const notify = kind === "sales_order" ? notifySuperAdmins : notifyAdmins;
  await notify({
    type: "payment.needs_refund",
    severity: "warning",
    title: `Refund needed — ${attempt.subject.ref}`,
    body: `${formatBDT(attempt.paidMinor ?? attempt.amountMinor)} paid online (${attempt.invoiceNumber}) ${ISSUE_TEXT[issue]}. Return it by hand, then record the refund.`,
    href:
      kind === "order" || kind === "order_due"
        ? `/admin/orders/${id}`
        : kind === "sales_order"
          ? `/admin/company/sales/orders/${id}`
          : kind === "medical_case"
            ? `/admin/tourism/cases/${id}`
            : kind === "travel_request"
              ? `/admin/tourism/travel/${id}`
              : "/admin/company/payments?status=needs_refund",
    entity: {
      kind: "PaymentAttempt",
      id: String(attempt._id),
      ref: attempt.invoiceNumber,
    },
  });
}

// ───────────────────────────── the sweeper ─────────────────────────────

export type SweepSummary = {
  checked: number;
  settled: number;
  expired: number;
  abandoned: number;
  errors: number;
  orderNumbers: string[];
};

/**
 * Every 5 minutes (Coolify scheduled task → /api/cron/expire-payments):
 *
 *  1. ask the gateway about every open try that is due — so a customer who
 *     paid and closed the tab is settled within minutes even if PayStation's
 *     notification never reaches us;
 *  2. for every order whose hold has run out, ask once more about all of its
 *     tries, and only then cancel it and put the stock back. A paid order is
 *     never cancelled for a lost notification.
 *
 * Cancels silently: an abandoned checkout is the common case, and mailing
 * every one of them would be noise. The reason is on the order's timeline.
 */
export async function sweepPayments(
  now: Date = new Date(),
): Promise<SweepSummary> {
  await connectToDatabase();
  const summary: SweepSummary = {
    checked: 0,
    settled: 0,
    expired: 0,
    abandoned: 0,
    errors: 0,
    orderNumbers: [],
  };

  for (const a of await dueOpenAttempts(now, 100)) {
    try {
      const r = await confirmAttempt(a.invoiceNumber, "sweep", now);
      summary.checked++;
      if (r.result === "paid") summary.settled++;
      if (r.attempt?.status === "abandoned") summary.abandoned++;
    } catch (e) {
      summary.errors++;
      logger.warn(`sweep could not check ${a.invoiceNumber}`, e);
      // Unreachable gateway: try again next run rather than every second.
      await claimAttempt(a._id, ["open"], {
        nextCheckAt: new Date(now.getTime() + EVERY_RUN_MS),
      });
    }
  }

  const holdAgo = new Date(now.getTime() - PAYMENT_HOLD_MINUTES * 60_000);
  const stale = await Order.find({
    status: "pending",
    $or: [
      {
        "payment.status": { $in: ["initiated", "failed"] },
        "payment.expiresAt": { $ne: null, $lte: now },
      },
      // Placed to be paid online but never handed to the gateway (the server
      // stopped in between): it still holds stock, so it expires too.
      {
        "payment.method": "online",
        "payment.status": "unpaid",
        "payment.expiresAt": null,
        createdAt: { $lte: holdAgo },
      },
    ],
  })
    .select({ _id: 1, orderNumber: 1 })
    .limit(200)
    .lean<{ _id: mongoose.Types.ObjectId; orderNumber: string }[]>()
    .exec();

  for (const o of stale) {
    const id = String(o._id);
    let paid = false;
    let unreachable = false;
    for (const a of await attemptsForSubject("order", id)) {
      if (a.status !== "open") continue;
      try {
        const r = await confirmAttempt(a.invoiceNumber, "sweep", now);
        if (r.result === "paid") paid = true;
      } catch (e) {
        unreachable = true;
        logger.warn(
          `sweep could not check ${a.invoiceNumber} before expiry`,
          e,
        );
      }
    }
    if (paid) {
      summary.settled++;
      continue;
    }
    // Never cancel on a guess: if the gateway could not be asked, wait.
    if (unreachable) {
      summary.errors++;
      continue;
    }
    const res = await transitionOrder(id, "cancelled", {
      internalNote: `Payment not completed within ${PAYMENT_HOLD_MINUTES} minutes; stock released.`,
      silent: true,
      // Written only if the hold is still over at that instant: a customer
      // whose "Pay again" just restarted it is not cancelled under them.
      guard: {
        $or: [
          { "payment.expiresAt": { $lte: now } },
          { "payment.expiresAt": null },
        ],
      },
    });
    if (res.ok) {
      summary.expired++;
      summary.orderNumbers.push(o.orderNumber);
    }
  }

  return summary;
}

// ───────────────────────────── admin ─────────────────────────────

/**
 * Re-check with PayStation: ask about every try of one thing (an order, a
 * purchase, an enrollment) that could still be money, and apply what it says.
 */
export async function recheckSubjectPayments(
  kinds: PaymentSubjectKind[],
  id: string,
): Promise<{ checked: number; results: ConfirmResult[] }> {
  const results: ConfirmResult[] = [];
  const attempts = (
    await Promise.all(kinds.map((k) => attemptsForSubject(k, id)))
  ).flat();
  for (const a of attempts) {
    if (a.status !== "open" && a.status !== "abandoned") continue;
    const r = await confirmAttempt(a.invoiceNumber, "admin");
    results.push(r.result);
  }
  return { checked: results.length, results };
}

/** Re-check an order's tries, paid at checkout or later from the account. */
export async function recheckOrderPayments(
  orderId: string,
): Promise<{ checked: number; results: ConfirmResult[] }> {
  return recheckSubjectPayments(["order", "order_due"], orderId);
}

// ───────────────────────────── the customer's return ─────────────────────────────

/**
 * Where to send a customer coming back from the gateway, after asking the
 * gateway what happened. `said` is the gateway's own word on the URL
 * (Successful / Failed / Canceled) — used only to word the page when the
 * money did not arrive, never to settle anything.
 */
export async function returnDestination(
  invoiceNumber: string,
  said: string | null,
): Promise<string> {
  let outcome: ConfirmOutcome | null = null;
  try {
    outcome = await confirmAttempt(invoiceNumber, "return");
  } catch (e) {
    logger.warn(`return check failed for ${invoiceNumber}`, e);
  }
  const attempt =
    outcome?.attempt ?? (await getAttemptByInvoice(invoiceNumber));
  if (!attempt) return "/";

  const hint = (said ?? "").toLowerCase();
  const state: string =
    attempt.status === "paid"
      ? "paid"
      : attempt.status === "needs_refund" || attempt.status === "refunded"
        ? "issue"
        : hint.startsWith("cancel")
          ? "cancelled"
          : hint.startsWith("fail")
            ? "failed"
            : hint.startsWith("success")
              ? "pending"
              : "failed";

  // Started from a pay link: back to the link, which shows how it went.
  if (attempt.requestId) {
    const request = await getRequestById(attempt.requestId);
    if (request) {
      const q = new URLSearchParams({ payment: state });
      return localized(
        attempt.locale,
        `/pay/${encodeURIComponent(request.token)}?${q.toString()}`,
      );
    }
  }
  if (
    attempt.subject.kind === "order" ||
    attempt.subject.kind === "order_due"
  ) {
    const order = await Order.findById(attempt.subject.id)
      .select({ orderNumber: 1, email: 1, storefront: 1 })
      .lean<Pick<LeanOrder, "orderNumber" | "email" | "storefront">>()
      .exec();
    if (!order) return localized(attempt.locale, "/");
    const q = new URLSearchParams({ email: order.email, payment: state });
    return localized(
      attempt.locale,
      `${STOREFRONT_PATH[order.storefront]}/order/${encodeURIComponent(order.orderNumber)}?${q.toString()}`,
    );
  }
  if (
    attempt.subject.kind === "software" ||
    attempt.subject.kind === "enrollment"
  ) {
    const q = new URLSearchParams({ payment: state });
    return localized(
      attempt.locale,
      `${DIGITAL[attempt.subject.kind].path}/${encodeURIComponent(attempt.subject.ref)}?${q.toString()}`,
    );
  }
  return localized(attempt.locale, "/");
}

// ───────────────────────────── software and courses ─────────────────────────────

type DigitalKind = "software" | "enrollment";

/** Where each digital sale is paid from, and which door it sits behind. */
const DIGITAL: Record<
  DigitalKind,
  { point: PaymentPoint; path: string; label: string }
> = {
  software: {
    point: "software",
    path: "/digihealth/purchase",
    label: "Digihealth",
  },
  enrollment: {
    point: "courses",
    path: "/medacademy/enrollment",
    label: "MedAcademy",
  },
};

type DigitalRecord = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  email: string;
  status: string;
  totalMinor: number;
  payment: { status: string };
  /** Software only. */
  productSnapshot?: { name: { en: string }; deliveryType: string };
};

async function loadDigital(
  kind: DigitalKind,
  number: string,
): Promise<DigitalRecord | null> {
  await connectToDatabase();
  return kind === "software"
    ? SoftwarePurchase.findOne({ purchaseNumber: number })
        .lean<DigitalRecord>()
        .exec()
    : Enrollment.findOne({ enrollmentNumber: number })
        .lean<DigitalRecord>()
        .exec();
}

/** Can this purchase or enrollment be paid online right now (owner aside)? */
export async function digitalPayable(
  kind: DigitalKind,
  record: Pick<DigitalRecord, "status" | "totalMinor" | "payment"> & {
    productSnapshot?: { deliveryType: string };
  },
): Promise<boolean> {
  if (record.status !== "pending" || record.payment.status === "paid")
    return false;
  if (record.totalMinor <= 0) return false;
  // External apps (ZenHcare) stay offline: their money is not ours to take.
  if (
    kind === "software" &&
    record.productSnapshot?.deliveryType === "external"
  ) {
    return false;
  }
  return onlinePointAvailable(DIGITAL[kind].point);
}

export type DigitalStartResult =
  | StartPaymentResult
  | { ok: false; reason: "phone_required" };

/**
 * Pay for one of the customer's own pending software purchases or course
 * enrollments. PayStation needs a phone number; the profile's is used, or the
 * one the customer types when the profile has none.
 */
export async function startDigitalPayment(
  kind: DigitalKind,
  number: string,
  who: { userId: string },
  opts: { phone?: string | null; locale?: string | null } = {},
): Promise<DigitalStartResult> {
  const record = await loadDigital(kind, number);
  if (!record || String(record.userId) !== who.userId) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await digitalPayable(kind, record))) {
    const offline = !(await onlinePointAvailable(DIGITAL[kind].point));
    return { ok: false, reason: offline ? "unavailable" : "not_payable" };
  }
  const provider = onlineProvider();
  if (!provider) return { ok: false, reason: "unavailable" };

  const prior = await attemptsForSubject(kind, String(record._id));
  if (prior.length >= MAX_OPEN_BILL_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const user = await findUserById(who.userId).catch(() => null);
  const phone = opts.phone?.trim() || user?.phone?.trim() || "";
  if (!phone) return { ok: false, reason: "phone_required" };

  // Whole taka; one created before rounding drops its poisha here.
  const amountMinor = wholeTaka(record.totalMinor);
  if (amountMinor <= 0) return { ok: false, reason: "not_payable" };
  const what =
    kind === "software"
      ? (record.productSnapshot?.name.en ?? "Software")
      : "Course enrollment";
  return beginAttempt({
    provider,
    subject: { kind, id: record._id, ref: number },
    amountMinor,
    roundingMinor: amountMinor - record.totalMinor,
    customer: {
      name: user?.name?.trim() || record.email.split("@")[0] || "Customer",
      phone,
      email: record.email,
    },
    reference: number,
    description: `${DIGITAL[kind].label}: ${what} (${number})`,
    locale: opts.locale,
  });
}

// ───────────────────────────── views ─────────────────────────────

export type CustomerPaymentState = {
  /** An online order still waiting for its money. */
  awaiting: boolean;
  canPayAgain: boolean;
  /** ISO time the held stock is released, while awaiting. */
  holdUntil: string | null;
  attemptsLeft: number;
};

/** What the order page needs to offer "Pay again", from the order alone. */
export function customerPaymentState(
  order: Pick<LeanOrder, "status" | "payment">,
  now: Date = new Date(),
): CustomerPaymentState {
  const p = order.payment;
  const awaiting =
    order.status === "pending" &&
    (p.method ?? "offline") === "online" &&
    p.status !== "paid";
  const expiresAt = p.expiresAt ? new Date(p.expiresAt) : null;
  const holding = !!expiresAt && expiresAt.getTime() > now.getTime();
  const left = Math.max(0, MAX_ORDER_ATTEMPTS - (p.attempts ?? 0));
  return {
    awaiting,
    canPayAgain: awaiting && holding && left > 0,
    holdUntil: awaiting && expiresAt ? expiresAt.toISOString() : null,
    attemptsLeft: left,
  };
}
