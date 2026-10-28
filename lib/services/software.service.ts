import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  SoftwarePurchase,
  type ISoftwarePurchase,
} from "@/lib/models/softwarePurchase";
import { markSubjectPaymentsForRefund } from "@/lib/repositories/payment-attempts.repo";
import { onlinePointAvailable } from "./payment-availability";
import { getSoftwareProductByIdLean } from "@/lib/repositories/software.repo";
import {
  getPurchaseByIdempotencyKey,
  getPurchaseById,
  getOpenPurchase,
  createPurchase,
} from "@/lib/repositories/purchases.repo";
import { getCommissionByPurchaseId } from "@/lib/repositories/commissions.repo";
import {
  reserveCouponUsage,
  releaseCouponUsage,
  releaseCouponUsageByCode,
} from "@/lib/repositories/coupons.repo";
import { validateCoupon } from "./coupon.service";
import { notifyAdmins } from "./notification.service";
import { getFulfillmentProvider } from "@/lib/fulfillment";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import { softwarePurchaseNumber } from "@/lib/ids";
import { roundingFor } from "@/lib/schemas/payment";
import {
  PURCHASE_TRANSITIONS,
  type PurchaseStatus,
} from "@/lib/schemas/systems";

// ---- Pricing (pure, unit-tested) ----

export type PurchaseCoupon = {
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor?: number;
} | null;

export type PurchaseTotals = {
  subtotalMinor: number;
  discountMinor: number;
  /** Poisha dropped so the total is whole taka (0 to −99). */
  roundingMinor: number;
  totalMinor: number;
};

/** Single-item software pricing: price − coupon discount (no shipping/tax). */
export function priceSoftware(
  priceMinor: number,
  coupon: PurchaseCoupon,
): PurchaseTotals {
  const subtotalMinor = Math.max(0, Math.round(priceMinor));
  let discountMinor = 0;
  if (
    coupon &&
    (coupon.minSubtotalMinor == null ||
      subtotalMinor >= coupon.minSubtotalMinor)
  ) {
    discountMinor =
      coupon.type === "percent"
        ? Math.round((subtotalMinor * coupon.value) / 100)
        : Math.round(coupon.value);
    discountMinor = Math.min(discountMinor, subtotalMinor);
  }
  // Whole taka, like every payable total (owner's decision, 2026-10-28).
  const roundingMinor = roundingFor(subtotalMinor - discountMinor);
  return {
    subtotalMinor,
    discountMinor,
    roundingMinor,
    totalMinor: subtotalMinor - discountMinor + roundingMinor,
  };
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

// ---- Buy ----

export type BuyResult =
  | { ok: true; purchase: ISoftwarePurchase }
  | {
      ok: false;
      code:
        | "product_not_found"
        | "not_active"
        | "not_purchasable"
        | "already_owned";
    };

/**
 * Buy a software product as a logged-in user. Idempotent on `idempotencyKey`.
 * `quote`-priced products are not purchasable (Inquiry only). Free totals are
 * marked paid + fulfilled instantly; priced purchases start `pending` until an
 * admin marks them paid (which runs fulfillment). No cart — one product.
 */
export async function buySoftware(args: {
  softwareProductId: string;
  userId: string;
  email: string;
  idempotencyKey: string;
  couponCode?: string;
}): Promise<BuyResult> {
  await connectToDatabase();

  const existingKey = await getPurchaseByIdempotencyKey(args.idempotencyKey);
  if (existingKey) return { ok: true, purchase: existingKey.toObject() };

  const product = await getSoftwareProductByIdLean(args.softwareProductId);
  if (!product) return { ok: false, code: "product_not_found" };
  if (product.status !== "active") return { ok: false, code: "not_active" };
  if (product.pricingModel === "quote" || product.priceMinor == null) {
    return { ok: false, code: "not_purchasable" };
  }

  const open = await getOpenPurchase(args.userId, args.softwareProductId);
  if (open) {
    if (open.status === "paid") return { ok: false, code: "already_owned" };
    return { ok: true, purchase: open.toObject() }; // resume a pending purchase
  }

  // Coupon (scoped to systems / all).
  let coupon: PurchaseCoupon = null;
  let couponId: string | undefined;
  let couponCode: string | undefined;
  if (args.couponCode) {
    const v = await validateCoupon(
      args.couponCode,
      product.priceMinor,
      new Date(),
      "systems",
    );
    if (v.ok) {
      coupon = {
        type: v.coupon.type,
        value: v.coupon.value,
        minSubtotalMinor: v.coupon.minSubtotalMinor,
      };
      couponId = v.coupon.id;
      couponCode = v.coupon.code;
    }
  }

  let totals = priceSoftware(product.priceMinor, coupon);

  // Atomically claim the coupon's slot before creating the purchase; if it was
  // exhausted in a race, drop the discount and re-price at full amount.
  let couponReserved = false;
  if (couponId) {
    couponReserved = await reserveCouponUsage(couponId);
    if (!couponReserved) {
      logger.warn(`coupon ${couponCode} exhausted at buy; dropping discount`);
      coupon = null;
      couponId = undefined;
      couponCode = undefined;
      totals = priceSoftware(product.priceMinor, null);
    }
  }

  const free = totals.totalMinor <= 0;
  const now = new Date();
  const status: PurchaseStatus = free ? "paid" : "pending";

  let purchase;
  try {
    purchase = await createPurchase({
      purchaseNumber: softwarePurchaseNumber(),
      userId: new mongoose.Types.ObjectId(args.userId),
      email: args.email,
      softwareProductId: product._id,
      productSnapshot: {
        name: product.name,
        slug: product.slug,
        priceMinor: product.priceMinor,
        deliveryType: product.deliveryType,
        externalApp: product.externalApp,
        affiliate: product.affiliate,
      },
      priceMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      roundingMinor: totals.roundingMinor,
      totalMinor: totals.totalMinor,
      currency: "BDT",
      couponCode,
      status,
      payment: {
        // Paid offline until online payment reaches this door (PayStation
        // plan, phase 2); asking the gateway here could only fail.
        provider: "manual",
        status: free ? "paid" : "unpaid",
        paidAt: free ? now : null,
      },
      idempotencyKey: args.idempotencyKey,
      fulfillment: { type: product.deliveryType, status: "pending" },
      timeline: [
        {
          status,
          at: now,
          note: free ? "Purchase created (free)" : "Purchase created",
        },
      ],
    } as Partial<ISoftwarePurchase>);
  } catch (err: unknown) {
    if (isDuplicateKey(err)) {
      // Concurrent retry (idempotency key) OR concurrent buy (userId+productId
      // partial unique index). Return the canonical purchase and release the
      // slot we just claimed, since the winning request reserved its own.
      if (couponReserved && couponId)
        await releaseCouponUsage(couponId).catch(() => {});
      const dup = await getPurchaseByIdempotencyKey(args.idempotencyKey);
      if (dup) return { ok: true, purchase: dup.toObject() };
      const open = await getOpenPurchase(args.userId, args.softwareProductId);
      if (open) {
        return open.status === "paid"
          ? { ok: false, code: "already_owned" }
          : { ok: true, purchase: open.toObject() };
      }
    }
    throw err;
  }

  // Free purchases are paid immediately → fulfill now.
  if (free) {
    await runFulfillment(purchase).catch((e) =>
      logger.warn("software fulfillment failed", e),
    );
  }
  // To be paid online (our own software, gateway on): it is only a purchase
  // once the money arrives, so no "arranged offline" email or bell now — the
  // paid email and bell confirm it (transitionPurchase → "paid").
  const payOnline =
    !free &&
    product.deliveryType !== "external" &&
    (await onlinePointAvailable("software"));
  if (!payOnline) {
    await sendPurchaseEmail(
      purchase.toObject(),
      localize(product.name, "en"),
      free ? "paid" : "pending",
    ).catch((e) => logger.warn("purchase email failed", e));
    await notifyPurchase(purchase, false);
  }

  return { ok: true, purchase: purchase.toObject() };
}

/** The team's bell: a software purchase to look at (or one just paid online). */
async function notifyPurchase(
  purchase: Pick<
    ISoftwarePurchase,
    "purchaseNumber" | "totalMinor" | "productSnapshot"
  > & { _id?: unknown },
  paidOnline: boolean,
) {
  await notifyAdmins({
    type: "software.purchased",
    severity: "success",
    title: paidOnline
      ? `New software purchase ${purchase.purchaseNumber} — paid online`
      : `New software purchase ${purchase.purchaseNumber}`,
    body: `${localize(purchase.productSnapshot.name, "en")} · ${formatBDT(purchase.totalMinor)}`,
    href: `/admin/software-purchases/${String(purchase._id)}`,
    entity: {
      kind: "SoftwarePurchase",
      id: String(purchase._id),
      ref: purchase.purchaseNumber,
    },
  });
}

// ---- Fulfillment (idempotent) ----

/** Run the delivery-type provider once. Safe to re-run (providers are idempotent). */
async function runFulfillment(
  purchase: mongoose.HydratedDocument<ISoftwarePurchase>,
): Promise<void> {
  if (purchase.fulfillment.status === "done") return;
  const ctx = {
    purchaseId: String(purchase._id),
    userId: String(purchase.userId),
    email: purchase.email,
    softwareProductId: String(purchase.softwareProductId),
    snapshot: purchase.productSnapshot,
    chargedMinor: purchase.totalMinor,
  };
  try {
    const result = await getFulfillmentProvider(
      purchase.productSnapshot.deliveryType,
    ).fulfill(ctx);
    purchase.fulfillment.licenseId = result.licenseId ?? null;
    purchase.fulfillment.provisioningTaskId = result.provisioningTaskId ?? null;
    purchase.fulfillment.commissionId = result.commissionId ?? null;
    purchase.fulfillment.status = "done";
    purchase.fulfillment.ranAt = new Date();
    await purchase.save();
  } catch (e) {
    purchase.fulfillment.status = "failed";
    await purchase.save().catch(() => {});
    throw e;
  }
}

// ---- Lifecycle transitions ----

export type PurchaseTransitionResult =
  | { ok: true; purchase: ISoftwarePurchase }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionPurchase(
  purchaseId: string,
  to: PurchaseStatus,
  opts: {
    note?: string;
    /** Refunding money taken online: how it went back (bKash/bank ref). */
    refundReference?: string;
    actorId?: string | null;
    /** Payment fields to write in the same move (the gateway's reference). */
    payment?: Partial<Record<"provider" | "txnId", string>>;
  } = {},
): Promise<PurchaseTransitionResult> {
  await connectToDatabase();
  const current = await getPurchaseById(purchaseId);
  if (!current) return { ok: false, code: "not_found" };
  if (!PURCHASE_TRANSITIONS[current.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  const now = new Date();
  const wasPaid = current.payment.status === "paid";
  const set: Record<string, unknown> = { status: to };
  if (to === "paid") {
    set["payment.status"] = "paid";
    set["payment.paidAt"] = now;
  }
  if (to === "refunded") set["payment.status"] = "refunded";
  for (const [k, v] of Object.entries(opts.payment ?? {})) {
    if (v) set[`payment.${k}`] = v;
  }
  // One conditional write on the status just read: an online payment and an
  // admin's "Mark paid" cannot both win, and only the winner fulfils.
  const purchase = await SoftwarePurchase.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      $set: set,
      $push: { timeline: { status: to, at: now, note: opts.note } },
    },
    { returnDocument: "after" },
  ).exec();
  if (!purchase) return { ok: false, code: "invalid_transition" };

  if (to === "paid" && opts.payment?.provider) {
    await notifyPurchase(purchase, true);
  }
  if (to === "refunded" && wasPaid) {
    // Money taken online goes back by hand: record how, or queue it.
    await markSubjectPaymentsForRefund("software", String(purchase._id), {
      reference: opts.refundReference,
      note: opts.note,
      actorId: opts.actorId,
    }).catch((e) =>
      logger.error("could not mark online payment for refund", e),
    );
  }

  if (to === "paid") {
    await runFulfillment(purchase).catch((e) =>
      logger.warn("software fulfillment failed", e),
    );
    await sendPurchaseEmail(
      purchase.toObject(),
      localize(purchase.productSnapshot.name, "en"),
      "paid",
    ).catch((e) => logger.warn("purchase email failed", e));
  }
  if (to === "refunded" || to === "cancelled") {
    // Return the coupon's redemption slot (terminal states → runs once).
    if (purchase.couponCode) {
      await releaseCouponUsageByCode(purchase.couponCode).catch((e) =>
        logger.warn("coupon release failed", e),
      );
    }
  }
  if (to === "refunded") {
    // Void the affiliate commission; the provisioning task is left to the
    // external app's admin to reconcile.
    const commission = await getCommissionByPurchaseId(purchaseId).catch(
      () => null,
    );
    if (commission && commission.status === "accrued") {
      commission.status = "void";
      await commission.save().catch(() => {});
    }
  }

  return { ok: true, purchase: purchase.toObject() };
}

/** Re-run fulfillment for a paid purchase whose previous attempt failed. */
export async function retryFulfillment(
  purchaseId: string,
): Promise<PurchaseTransitionResult> {
  await connectToDatabase();
  const purchase = await getPurchaseById(purchaseId);
  if (!purchase) return { ok: false, code: "not_found" };
  if (purchase.status !== "paid") {
    return { ok: false, code: "invalid_transition" };
  }
  await runFulfillment(purchase);
  return { ok: true, purchase: purchase.toObject() };
}

// ---- Email ----

async function sendPurchaseEmail(
  p: ISoftwarePurchase,
  productName: string,
  event: "pending" | "paid",
) {
  const deliveryNote =
    p.productSnapshot.deliveryType === "external"
      ? "Your access is being activated and you'll be notified shortly."
      : p.productSnapshot.deliveryType === "license"
        ? "Your license key is available in your account."
        : "Your download is available in your account.";
  const subject =
    event === "paid"
      ? `Purchase confirmed: ${productName}`
      : `Order received: ${productName}`;
  const rows: EmailDetailRow[] = [{ label: "Product", value: productName }];
  if (event !== "paid") {
    rows.push({
      label: "Total due",
      value: formatBDT(p.totalMinor),
      strong: true,
    });
  }
  rows.push({ label: "Reference", value: p.purchaseNumber });

  const built = renderEmail({
    accent: "teal",
    preheader:
      event === "paid"
        ? `Your purchase of "${productName}" is confirmed.`
        : `We received your order for "${productName}".`,
    eyebrow: event === "paid" ? "Purchase confirmed" : "Order received",
    heading:
      event === "paid"
        ? "Your purchase is confirmed"
        : "We've received your order",
    paragraphs: [
      event === "paid"
        ? `Your purchase of "${productName}" is confirmed. ${deliveryNote}`
        : `Thanks for your order for "${productName}". Payment is arranged offline — your access opens as soon as it's confirmed.`,
    ],
    details: { rows },
  });
  await getMailer().send({
    to: p.email,
    subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
