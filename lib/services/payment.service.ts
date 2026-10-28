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
import { feeFor } from "@/lib/payments/fees";
import { placeOrder, transitionOrder } from "./order.service";
import {
  getPaymentSettings,
  isPaymentPointOn,
} from "./payment-settings.service";
import type { CartOwner } from "@/lib/repositories/cart.repo";
import { PAYMENT_HOLD_MINUTES, type CheckoutInput } from "@/lib/schemas/order";
import {
  EMI_MIN_MINOR,
  MAX_ORDER_ATTEMPTS,
  type PaymentCheckVia,
  type PaymentIssue,
  type PaymentPoint,
} from "@/lib/schemas/payment";
import { notifyAdmins } from "./notification.service";
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
function onlineProvider(): PaymentProvider | null {
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
  const amountMinor = claimed.totalMinor - (claimed.totalMinor % 100);
  if (amountMinor <= 0) return { ok: false, reason: "not_payable" };
  const settings = await getPaymentSettings();
  const invoiceNumber = newInvoiceNumber();
  const attempt = await createAttempt({
    invoiceNumber,
    provider: provider.name,
    mode: provider.mode,
    subject: {
      kind: "order",
      id: claimed._id as mongoose.Types.ObjectId,
      ref: claimed.orderNumber,
    },
    amountMinor,
    roundingMinor:
      amountMinor !== claimed.totalMinor
        ? amountMinor - claimed.totalMinor
        : undefined,
    status: "open",
    locale: opts.locale ?? null,
    nextCheckAt: new Date(now.getTime() + FIRST_LOOK_MS),
  });

  const a = claimed.shippingAddress;
  const items = claimed.items.reduce((n, it) => n + it.qty, 0);
  const started = await provider.start!({
    invoiceNumber,
    amountMinor,
    customer: {
      name: a.label?.trim() || claimed.email.split("@")[0] || "Customer",
      phone: a.phone,
      email: claimed.email,
      address: [a.line1, a.city, a.district].filter(Boolean).join(", "),
    },
    reference: claimed.orderNumber,
    description: `${claimed.storefront === "instruments" ? "Medtrade" : "Spiber Kart"} order ${claimed.orderNumber} · ${items} item${items === 1 ? "" : "s"}`,
    callbackUrl: callbackUrl(invoiceNumber),
    emi: settings.emi && amountMinor >= EMI_MIN_MINOR,
  });

  if (!started.ok) {
    logger.error(
      `payment start refused for ${claimed.orderNumber} (${invoiceNumber}): ${started.reason} ${started.detail ?? ""}`,
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
 * "Pay again" from the order page. A guest proves the order is theirs with its
 * email, exactly like the order lookup; a signed-in owner needs nothing more.
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
  return startOrderPayment(String(order._id), { locale });
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
    default:
      // A kind whose handler is not built yet must never swallow money.
      logger.error(`no payment handler for ${attempt.subject.kind}`);
      return { ok: false, issue: "late" };
  }
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

const ISSUE_TEXT: Record<PaymentIssue, string> = {
  late: "arrived after it was cancelled",
  duplicate: "was already paid",
  amount_mismatch: "came in for the wrong amount",
  cancelled: "was cancelled after payment",
};

async function alertRefund(attempt: LeanAttempt, issue: PaymentIssue) {
  await notifyAdmins({
    type: "payment.needs_refund",
    severity: "warning",
    title: `Refund needed — ${attempt.subject.ref}`,
    body: `${formatBDT(attempt.paidMinor ?? attempt.amountMinor)} paid online (${attempt.invoiceNumber}) ${ISSUE_TEXT[issue]}. Return it by hand, then record the refund.`,
    href:
      attempt.subject.kind === "order" || attempt.subject.kind === "order_due"
        ? `/admin/orders/${String(attempt.subject.id)}`
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

/** Re-check with PayStation: ask about every try of one order that could still be money. */
export async function recheckOrderPayments(
  orderId: string,
): Promise<{ checked: number; results: ConfirmResult[] }> {
  const results: ConfirmResult[] = [];
  const attempts = [
    ...(await attemptsForSubject("order", orderId)),
    ...(await attemptsForSubject("order_due", orderId)),
  ];
  for (const a of attempts) {
    if (a.status !== "open" && a.status !== "abandoned") continue;
    const r = await confirmAttempt(a.invoiceNumber, "admin");
    results.push(r.result);
  }
  return { checked: results.length, results };
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

  if (attempt.subject.kind === "order") {
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
  return localized(attempt.locale, "/");
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
