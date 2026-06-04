import type { DeliveryType } from "@/lib/schemas/systems";
import type { IPurchaseProductSnapshot } from "@/lib/models/softwarePurchase";

/** The minimal, decoupled context a fulfillment provider needs (testable). */
export interface FulfillmentContext {
  purchaseId: string;
  userId: string;
  email: string;
  softwareProductId: string;
  snapshot: IPurchaseProductSnapshot;
  /** Amount actually charged for this purchase (after coupon) = purchase.totalMinor.
   *  Affiliate commission is computed from this, not the list price. */
  chargedMinor: number;
}

/** Ids of whatever fulfillment produced; merged into purchase.fulfillment. */
export interface FulfillmentResult {
  licenseId?: string;
  provisioningTaskId?: string;
  commissionId?: string;
}

/**
 * Pluggable fulfillment seam (mirrors lib/payments). One provider per
 * deliveryType. `fulfill` MUST be idempotent — it may run more than once for
 * the same purchase (double "mark paid", retry). The external provider is the
 * future-proof one: the manual variant emails the external app's super admin +
 * records a commission now; an automated provider (e.g. a ZenHcare API call)
 * drops in later without changing the purchase service.
 */
export interface FulfillmentProvider {
  readonly type: DeliveryType;
  fulfill(ctx: FulfillmentContext): Promise<FulfillmentResult>;
}

/** Mongo duplicate-key — used to make create-on-first-run idempotent under races. */
export function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}
