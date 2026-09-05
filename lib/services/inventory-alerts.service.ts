import {
  listStockUnits,
  type StockUnit,
} from "@/lib/repositories/inventory.repo";
import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";

/**
 * Low-stock alerts, part 3 of 3: the bell fires on threshold crossings
 * (inventory.service), the dashboard shows the live count, and this module
 * sends the DAILY DIGEST email — every tracked, active unit at or below its
 * threshold, lowest balance first. Triggered by `/api/cron/low-stock-digest`
 * (a scheduled call with `CRON_SECRET`, or an admin from the hub).
 */

const LAST_SENT_KEY = "inventory.digest.lastSentAt";
const MAX_ROWS = 40;

const STORE_LABEL: Record<StockUnit["storefront"], string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
};

export function digestRecipient(): string {
  return (
    process.env.INVENTORY_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}

export type DigestResult = {
  sent: boolean;
  to: string;
  low: number;
  out: number;
  skipped?: "nothing_low";
  at: string;
};

/** Every active, tracked unit at or below its threshold (out first, then low). */
export async function collectLowStock(
  limit = 200,
): Promise<{ low: StockUnit[]; out: StockUnit[] }> {
  const res = await listStockUnits({
    status: "active",
    tracked: true,
    level: ["low", "out"],
    sort: "stock",
    dir: "asc",
    pageSize: limit,
  });
  return {
    low: res.items.filter((u) => u.level === "low"),
    out: res.items.filter((u) => u.level === "out"),
  };
}

function summarise(low: number, out: number): string {
  if (out > 0 && low > 0) return `${out} out of stock and ${low} running low`;
  if (out > 0) return `${out} out of stock`;
  if (low > 0) return `${low} running low`;
  return "every tracked unit is above its threshold";
}

/**
 * Send the digest. Skipped (not sent) when nothing is low, unless `force`
 * (an admin pressing "Send now" always gets a mail, even an all-clear one).
 */
export async function sendLowStockDigest(
  opts: { force?: boolean } = {},
): Promise<DigestResult> {
  const { low, out } = await collectLowStock();
  const at = new Date().toISOString();
  const to = digestRecipient();
  const total = low.length + out.length;
  if (total === 0 && !opts.force) {
    return { sent: false, to, low: 0, out: 0, skipped: "nothing_low", at };
  }

  const units = [...out, ...low].slice(0, MAX_ROWS);
  const summary = summarise(low.length, out.length);
  const when = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const rows = units.map((u) => ({
    label: `${u.name}${u.variantLabel ? ` · ${u.variantLabel}` : ""} (${u.sku} · ${STORE_LABEL[u.storefront]})`,
    value:
      u.stock <= 0 ? "Out of stock" : `${u.stock} left · low at ${u.threshold}`,
    strong: u.stock <= 0,
  }));

  const built = renderEmail({
    preheader: `Stock digest: ${summary}`,
    eyebrow: "Daily stock digest",
    heading: total > 0 ? "Stock needs attention" : "Stock is healthy",
    paragraphs: [
      `As of ${when} (Dhaka time), ${summary}.`,
      total > 0
        ? "Lowest balances first. Seller-managed listings are included so you can follow up with the seller."
        : "No action needed today.",
    ],
    details:
      units.length > 0
        ? { title: "At or below the low-stock threshold", rows }
        : undefined,
    button: {
      label: "Open inventory",
      url: `${siteConfig.url}/en/admin/inventory?level=low`,
    },
    outro:
      total > MAX_ROWS
        ? [`… and ${total - MAX_ROWS} more in the inventory hub.`]
        : undefined,
  });

  await getMailer().send({
    to,
    subject: `Stock digest: ${summary}`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
  await setSetting(LAST_SENT_KEY, at).catch((e) =>
    logger.warn("inventory: could not record digest timestamp", e),
  );
  return { sent: true, to, low: low.length, out: out.length, at };
}

export async function lastDigestSentAt(): Promise<string | null> {
  try {
    return await getSetting<string>(LAST_SENT_KEY);
  } catch {
    return null;
  }
}
