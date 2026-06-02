import {
  createProvisioningTask,
  getTaskByPurchaseId,
} from "@/lib/repositories/provisioning.repo";
import {
  createCommission,
  getCommissionByPurchaseId,
} from "@/lib/repositories/commissions.repo";
import { getMailer } from "@/lib/mailer";
import { siteConfig } from "@/lib/site-config";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import type { FulfillmentProvider, FulfillmentContext } from "../types";
import { isDuplicateKey } from "../types";

/**
 * External-app provisioning (e.g. ZenHcare), MANUAL variant. On a paid purchase:
 *  1. create a ProvisioningTask so the external app's super admin can activate
 *     the user (notified by email — `ZENHCARE_ADMIN_EMAIL`),
 *  2. accrue the Spiber owner's affiliate commission (the "cut").
 * Both are idempotent on `purchaseId`. A future automated provider replaces this
 * one (calls the external API) without touching the purchase service.
 */
export const externalManualProvider: FulfillmentProvider = {
  type: "external",
  async fulfill(ctx) {
    const externalApp = ctx.snapshot.externalApp ?? "external";

    const provisioningTaskId = await ensureProvisioningTask(ctx, externalApp);
    const commissionId = await ensureCommission(ctx, externalApp);

    await notifyExternalAdmin(ctx, externalApp).catch((e) =>
      logger.warn("external provisioning notify email failed", e),
    );

    return { provisioningTaskId, commissionId };
  },
};

async function ensureProvisioningTask(
  ctx: FulfillmentContext,
  externalApp: string,
): Promise<string> {
  const existing = await getTaskByPurchaseId(ctx.purchaseId);
  if (existing) return String(existing._id);
  try {
    const task = await createProvisioningTask({
      purchaseId: ctx.purchaseId,
      softwareProductId: ctx.softwareProductId,
      userId: ctx.userId,
      email: ctx.email,
      externalApp,
      status: "open",
      provider: "manual",
    });
    return String(task._id);
  } catch (err) {
    if (isDuplicateKey(err)) {
      const dup = await getTaskByPurchaseId(ctx.purchaseId);
      if (dup) return String(dup._id);
    }
    throw err;
  }
}

async function ensureCommission(
  ctx: FulfillmentContext,
  externalApp: string,
): Promise<string> {
  const existing = await getCommissionByPurchaseId(ctx.purchaseId);
  if (existing) return String(existing._id);

  const basePriceMinor = ctx.snapshot.priceMinor;
  const rateBp = ctx.snapshot.affiliate?.rateBp ?? 0;
  const amountMinor = Math.round((basePriceMinor * rateBp) / 10000);

  try {
    const commission = await createCommission({
      purchaseId: ctx.purchaseId,
      softwareProductId: ctx.softwareProductId,
      externalApp,
      userId: ctx.userId,
      basePriceMinor,
      rateBp,
      amountMinor,
      currency: "BDT",
      status: "accrued",
      accruedAt: new Date(),
    });
    return String(commission._id);
  } catch (err) {
    if (isDuplicateKey(err)) {
      const dup = await getCommissionByPurchaseId(ctx.purchaseId);
      if (dup) return String(dup._id);
    }
    throw err;
  }
}

async function notifyExternalAdmin(
  ctx: FulfillmentContext,
  externalApp: string,
) {
  const to = process.env.ZENHCARE_ADMIN_EMAIL;
  if (!to) {
    logger.warn(
      `ZENHCARE_ADMIN_EMAIL not set — provisioning task created but no notification sent (purchase ${ctx.purchaseId})`,
    );
    return;
  }
  const product = localize(ctx.snapshot.name, "en");
  const subject = `[${externalApp}] Activate access for ${ctx.email}`;
  const body =
    `A ${externalApp} purchase was paid on ${siteConfig.brand} and needs manual activation.\n\n` +
    `Product: ${product}\nUser: ${ctx.email}\nAmount: ${formatBDT(ctx.snapshot.priceMinor)}\n\n` +
    `Please activate this user in ${externalApp}, then mark the provisioning task done in the admin panel.`;
  await getMailer().send({
    to,
    subject,
    text: `${subject}\n\n${body}\n\n${siteConfig.brand}`,
    html: `<p>A <strong>${externalApp}</strong> purchase was paid on ${siteConfig.brand} and needs manual activation.</p><ul><li>Product: ${product}</li><li>User: ${ctx.email}</li><li>Amount: ${formatBDT(ctx.snapshot.priceMinor)}</li></ul><p>Activate the user in ${externalApp}, then mark the provisioning task done in the admin panel.</p>`,
  });
}
