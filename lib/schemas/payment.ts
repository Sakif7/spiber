import { z } from "zod";

/**
 * Online payments through the gateway (PayStation), shared by every place the
 * site takes money: one attempt per try at the gateway, whatever is being paid.
 *
 * Client-safe: no DB import, so admin forms and customer pages can use the
 * enums and limits directly.
 */

/** What an attempt pays for. Each kind has one handler that applies it. */
export const paymentSubjectKindEnum = z.enum([
  /** A storefront order paid at checkout (or "Pay again" while it is held). */
  "order",
  /** A credit / COD order paid later from the customer's account. */
  "order_due",
  "software",
  "enrollment",
  "sales_order",
  "medical_case",
  "travel_request",
]);
export type PaymentSubjectKind = z.infer<typeof paymentSubjectKindEnum>;

/**
 * open         handed to the gateway, not confirmed either way yet
 * paid         confirmed by the gateway and applied to what it paid for
 * failed       the gateway said it failed
 * abandoned    never completed; we stopped asking
 * needs_refund the money arrived but could not be applied (cancelled first,
 *              already paid another way, wrong amount) — someone returns it
 * refunded     returned by hand and recorded
 */
export const paymentAttemptStatusEnum = z.enum([
  "open",
  "paid",
  "failed",
  "abandoned",
  "needs_refund",
  "refunded",
]);
export type PaymentAttemptStatus = z.infer<typeof paymentAttemptStatusEnum>;

/** How an attempt reads in the admin, and the badge tone it takes. */
export const ATTEMPT_STATUS_VIEW: Record<
  PaymentAttemptStatus,
  { label: string; tone: "success" | "warning" | "info" | "neutral" | "danger" }
> = {
  open: { label: "Waiting", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  abandoned: { label: "Abandoned", tone: "neutral" },
  needs_refund: { label: "Needs refund", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
};

/**
 * Why money has to go back:
 *  late            it arrived after what it paid for was cancelled
 *  duplicate       what it paid for was already paid (another try, by hand)
 *  amount_mismatch the gateway took a different amount from the one asked
 *  cancelled       it was applied, and then the order was cancelled/refunded
 */
export const paymentIssueEnum = z.enum([
  "late",
  "duplicate",
  "amount_mismatch",
  "cancelled",
]);
export type PaymentIssue = z.infer<typeof paymentIssueEnum>;

/** Where a look at the gateway came from — kept on the attempt for disputes. */
export const paymentCheckViaEnum = z.enum([
  "start",
  "return",
  "ipn",
  "sweep",
  "admin",
]);
export type PaymentCheckVia = z.infer<typeof paymentCheckViaEnum>;

/**
 * The places that can take money online, each switched on separately so the
 * gateway can go live one door at a time. All start switched off.
 */
export const paymentPointEnum = z.enum([
  "kart",
  "medtrade",
  "software",
  "courses",
  "order_due",
  "sales_link",
  "tourism",
]);
export type PaymentPoint = z.infer<typeof paymentPointEnum>;

export const PAYMENT_POINT_LABEL: Record<PaymentPoint, string> = {
  kart: "Spiber Kart checkout",
  medtrade: "Medtrade checkout",
  software: "Digihealth software",
  courses: "MedAcademy courses",
  order_due: "Credit / COD orders paid later",
  sales_link: "Sales invoice payment links",
  tourism: "Tourism quotes",
};

/** The payment points this build actually serves; the rest wait for their phase. */
export const LIVE_PAYMENT_POINTS: readonly PaymentPoint[] = [
  "kart",
  "medtrade",
];

/**
 * How a payment was made, for the fee table. The gateway names methods its own
 * way ("bKash", "MASTERCARD", …); `feeMethodOf` folds them onto these.
 */
export const feeMethodEnum = z.enum([
  "bkash",
  "nagad",
  "rocket",
  "upay",
  "visa",
  "mastercard",
  "other",
]);
export type FeeMethod = z.infer<typeof feeMethodEnum>;

export const FEE_METHOD_LABEL: Record<FeeMethod, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
  visa: "Visa",
  mastercard: "Mastercard",
  other: "Anything else",
};

/** A day, `YYYY-MM-DD`, read in Dhaka time. */
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Basis points, 0–10%: 185 = 1.85%. */
const rateBp = z.number().int().min(0).max(1000);

/**
 * One set of fee rates, in force from a day until the next set starts. Fees
 * are frozen on each payment when it settles, so a new set never rewrites a
 * payment already taken.
 */
export const feeRateVersionSchema = z.object({
  from: dayKey,
  rates: z.object({
    bkash: rateBp,
    nagad: rateBp,
    rocket: rateBp,
    upay: rateBp,
    visa: rateBp,
    mastercard: rateBp,
    other: rateBp,
  }),
});
export type FeeRateVersion = z.infer<typeof feeRateVersionSchema>;

export type PaymentSettings = {
  points: Record<PaymentPoint, boolean>;
  /** Offer EMI on PayStation's page for payments of at least EMI_MIN_MINOR. */
  emi: boolean;
  feeRates: FeeRateVersion[];
};

export const PAYMENT_SETTINGS_DEFAULTS: PaymentSettings = {
  points: {
    kart: false,
    medtrade: false,
    software: false,
    courses: false,
    order_due: false,
    sales_link: false,
    tourism: false,
  },
  emi: false,
  feeRates: [],
};

/**
 * PATCH body. Built from bare fields rather than `.partial()` of a defaulted
 * object: Zod 4 would fill the defaults back in and reset every other switch.
 */
export const paymentSettingsPatchSchema = z
  .object({
    // partialRecord: Zod 4's z.record over an enum demands every key, which
    // would refuse a patch that names one door.
    points: z.partialRecord(paymentPointEnum, z.boolean()).optional(),
    emi: z.boolean().optional(),
  })
  .strict();
export type PaymentSettingsPatch = z.infer<typeof paymentSettingsPatchSchema>;

/** Add (or replace, same day) one set of fee rates. */
export const feeRateVersionInputSchema = feeRateVersionSchema;

export const paymentRefundSchema = z.object({
  reference: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
});
export type PaymentRefundInput = z.infer<typeof paymentRefundSchema>;

export const paymentFeeCorrectionSchema = z.object({
  feeMinor: z.number().int().min(0).max(10_000_000),
  note: z.string().trim().max(500).optional(),
});
export type PaymentFeeCorrectionInput = z.infer<
  typeof paymentFeeCorrectionSchema
>;

/** PayStation offers EMI from ৳5,000 up. */
export const EMI_MIN_MINOR = 500_000;

/** Tries a customer gets on one order before it has to be placed again. */
export const MAX_ORDER_ATTEMPTS = 3;

/**
 * The gateway takes whole taka, and a courier cannot collect poisha either, so
 * a payable total drops its poisha. Returns the (negative or zero) rounding
 * that makes `totalMinor` a whole number of taka.
 */
export function roundingFor(totalMinor: number): number {
  const poisha = totalMinor > 0 ? totalMinor % 100 : 0;
  // Never -0: it would print as "−৳0.00" and compare unequal in tests.
  return poisha === 0 ? 0 : -poisha;
}
