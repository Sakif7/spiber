import {
  createLicense,
  getLicenseByPurchaseId,
} from "@/lib/repositories/licenses.repo";
import { licenseKey } from "@/lib/ids";
import type { FulfillmentProvider } from "./types";
import { isDuplicateKey } from "./types";

/**
 * License delivery: issue an active license key bound to the purchase + user.
 * Idempotent — looks up an existing license by purchaseId first, and the unique
 * index on `key` plus a duplicate-key re-fetch guards against races.
 */
export const licenseProvider: FulfillmentProvider = {
  type: "license",
  async fulfill(ctx) {
    const existing = await getLicenseByPurchaseId(ctx.purchaseId);
    if (existing) return { licenseId: String(existing._id) };

    try {
      const license = await createLicense({
        softwareProductId: ctx.softwareProductId,
        userId: ctx.userId,
        purchaseId: ctx.purchaseId,
        key: licenseKey(),
        status: "active",
        issuedAt: new Date(),
      });
      return { licenseId: String(license._id) };
    } catch (err) {
      if (isDuplicateKey(err)) {
        const dup = await getLicenseByPurchaseId(ctx.purchaseId);
        if (dup) return { licenseId: String(dup._id) };
      }
      throw err;
    }
  },
};
