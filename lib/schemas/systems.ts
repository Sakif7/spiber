import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Spiber Digihealth (digital software). Zod is the single source of truth;
 * Mongoose models + TS types derive from it. Money is integer poisha.
 *
 * A SoftwareProduct has a `deliveryType` discriminator (asset | license |
 * external) that drives fulfillment. This intentionally replaces the data-model
 * doc's bare `licenseRequired: boolean` — three delivery modes need an explicit
 * enum (see the decision log). A SoftwarePurchase is a lightweight digital
 * order (no cart/stock/shipping), mirroring Enrollment, with manual offline
 * payment: pending → paid → fulfillment runs.
 */

// ---- enums ----
export const softwarePricingModelEnum = z.enum([
  "one_time",
  "subscription",
  "quote",
]);
export type SoftwarePricingModel = z.infer<typeof softwarePricingModelEnum>;

export const deliveryTypeEnum = z.enum(["asset", "license", "external"]);
export type DeliveryType = z.infer<typeof deliveryTypeEnum>;

export const softwareStatusEnum = z.enum(["draft", "active", "archived"]);
export type SoftwareStatus = z.infer<typeof softwareStatusEnum>;

// ---- affiliate config (external products) ----
// Basis points: commission = priceMinor * rateBp / 10000 (e.g. 1500 = 15%).
export const affiliateConfigSchema = z.object({
  rateBp: z.number().int().min(0).max(10000),
});
export type AffiliateConfig = z.infer<typeof affiliateConfigSchema>;

// ---- SoftwareProduct ----
// `slug` is optional on input; the route derives it from `name.en` when blank.
export const softwareProductSchema = z
  .object({
    name: localizedSchema,
    slug: z.string().max(160).optional(),
    categoryId: z.string().optional(),
    description: localizedSchema.optional(),
    screenshots: z.array(z.string()).default([]),
    features: z.array(localizedSchema).default([]),
    pricingModel: softwarePricingModelEnum,
    priceMinor: z.number().int().nonnegative().optional(),
    demoUrl: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().url().optional(),
    ),
    deliveryType: deliveryTypeEnum,
    assetKey: z.string().optional(),
    externalApp: z.string().max(120).optional(),
    affiliate: affiliateConfigSchema.optional(),
    status: softwareStatusEnum.default("draft"),
  })
  .refine((d) => d.pricingModel === "quote" || d.priceMinor != null, {
    message: "priceMinor is required unless pricingModel is 'quote'",
    path: ["priceMinor"],
  })
  .refine((d) => d.deliveryType !== "asset" || !!d.assetKey, {
    message: "assetKey is required for asset delivery",
    path: ["assetKey"],
  })
  .refine((d) => d.deliveryType !== "external" || !!d.externalApp, {
    message: "externalApp is required for external delivery",
    path: ["externalApp"],
  });
export type SoftwareProductInput = z.infer<typeof softwareProductSchema>;

/**
 * Partial-update schema for PATCH: every field optional and NO defaults, so
 * omitting a field leaves it untouched (the create schema's `status: draft` /
 * empty-array defaults would otherwise silently un-publish or wipe data). The
 * delivery-type invariants are still enforced when the relevant fields are sent
 * (the admin form always sends deliveryType together with its dependent field).
 */
export const softwareProductUpdateSchema = z
  .object({
    name: localizedSchema.optional(),
    slug: z.string().max(160).optional(),
    categoryId: z.string().optional(),
    description: localizedSchema.optional(),
    screenshots: z.array(z.string()).optional(),
    features: z.array(localizedSchema).optional(),
    pricingModel: softwarePricingModelEnum.optional(),
    priceMinor: z.number().int().nonnegative().optional(),
    demoUrl: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().url().optional(),
    ),
    deliveryType: deliveryTypeEnum.optional(),
    assetKey: z.string().optional(),
    externalApp: z.string().max(120).optional(),
    affiliate: affiliateConfigSchema.optional(),
    status: softwareStatusEnum.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.deliveryType === "asset" && !d.assetKey)
      ctx.addIssue({
        code: "custom",
        path: ["assetKey"],
        message: "assetKey is required for asset delivery",
      });
    if (d.deliveryType === "external" && !d.externalApp)
      ctx.addIssue({
        code: "custom",
        path: ["externalApp"],
        message: "externalApp is required for external delivery",
      });
    if (d.pricingModel && d.pricingModel !== "quote" && d.priceMinor == null)
      ctx.addIssue({
        code: "custom",
        path: ["priceMinor"],
        message: "priceMinor is required unless pricingModel is 'quote'",
      });
  });
export type SoftwareProductUpdateInput = z.infer<
  typeof softwareProductUpdateSchema
>;

// ---- SoftwarePurchase (digital order-lite) ----
export const purchaseStatusEnum = z.enum([
  "pending",
  "paid",
  "cancelled",
  "refunded",
]);
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>;

/** Allowed status transitions enforced by the software service. */
export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

/** Buy request from a logged-in user. Server re-prices; never trusts amounts. */
export const buyInputSchema = z.object({
  softwareProductId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128),
  couponCode: z.string().trim().max(64).optional(),
  /** The buyer's language, so the payment gateway sends them back to it. */
  locale: z.enum(["en", "bn", "ja"]).optional(),
});
export type BuyInput = z.infer<typeof buyInputSchema>;

/** Admin purchase status transition (to:"paid" triggers fulfillment). */
export const purchaseTransitionSchema = z.object({
  to: purchaseStatusEnum,
  note: z.string().max(1000).optional(),
  /** Refunding money taken online: how it went back (bKash / bank reference). */
  refundReference: z.string().trim().max(120).optional(),
});
export type PurchaseTransitionInput = z.infer<typeof purchaseTransitionSchema>;

// ---- License ----
export const licenseStatusEnum = z.enum(["issued", "active", "revoked"]);
export type LicenseStatus = z.infer<typeof licenseStatusEnum>;

export const LICENSE_TRANSITIONS: Record<LicenseStatus, LicenseStatus[]> = {
  issued: ["active", "revoked"],
  active: ["revoked"],
  revoked: ["active"],
};

export const licenseStatusUpdateSchema = z.object({
  status: licenseStatusEnum,
});
export type LicenseStatusUpdateInput = z.infer<
  typeof licenseStatusUpdateSchema
>;

// ---- ProvisioningTask (external delivery, e.g. ZenHcare) ----
export const provisioningStatusEnum = z.enum([
  "open",
  "in_progress",
  "done",
  "failed",
]);
export type ProvisioningStatus = z.infer<typeof provisioningStatusEnum>;

export const provisioningUpdateSchema = z.object({
  status: provisioningStatusEnum,
  note: z.string().max(1000).optional(),
});
export type ProvisioningUpdateInput = z.infer<typeof provisioningUpdateSchema>;

// ---- AffiliateCommission ----
export const commissionStatusEnum = z.enum(["accrued", "paid", "void"]);
export type CommissionStatus = z.infer<typeof commissionStatusEnum>;

export const commissionStatusUpdateSchema = z.object({
  status: commissionStatusEnum,
  note: z.string().max(1000).optional(),
});
export type CommissionStatusUpdateInput = z.infer<
  typeof commissionStatusUpdateSchema
>;
