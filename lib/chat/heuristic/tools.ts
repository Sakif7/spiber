/**
 * Live-data "tools" for the chat engine — the only place that touches the DB.
 * Each tool turns a repository/service result into render-ready `ChatCard`s
 * (localized titles, formatted prices, canonical hrefs, in-chat actions).
 *
 * These are deliberately small, typed, side-effect-free reads so the SAME
 * registry can later be exposed to an LLM as tool-calls without changes.
 */
import type { Locale } from "@/i18n/routing";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { searchAll } from "@/lib/services/search.service";
import { findOrderForGuest } from "@/lib/repositories/orders.repo";
import { getMedicalCaseByNumber } from "@/lib/repositories/medicalCases.repo";
import { bcp47 } from "@/lib/i18n/intl-locale";
import { logger } from "@/lib/log";
import type { ChatCard } from "../types";
import { LABELS, ROUTES, pick, type L } from "./content";

/* ── Localized price / status helpers ────────────────────────────────────── */

const PRICE: Record<"onRequest" | "free" | "from", L> = {
  onRequest: {
    en: "Price on request",
    bn: "মূল্য চাহিদা অনুযায়ী",
    ja: "価格はお問い合わせ",
  },
  free: { en: "Free", bn: "ফ্রি", ja: "無料" },
  from: { en: "From", bn: "থেকে", ja: "〜より" },
};

function priceLabel(minor: number | null | undefined, locale: Locale): string {
  if (minor == null) return pick(PRICE.onRequest, locale);
  if (minor === 0) return pick(PRICE.free, locale);
  return formatBDT(minor, locale);
}

function marketplacePrice(
  base: number | null | undefined,
  variants: { priceMinorOverride?: number | null }[] | undefined,
  locale: Locale,
): string {
  if (base != null) return priceLabel(base, locale);
  const prices = (variants ?? [])
    .map((v) => v.priceMinorOverride)
    .filter((n): n is number => typeof n === "number");
  if (prices.length === 0) return pick(PRICE.onRequest, locale);
  const min = Math.min(...prices);
  return min === 0
    ? pick(PRICE.free, locale)
    : `${pick(PRICE.from, locale)} ${formatBDT(min, locale)}`;
}

const ORDER_STATUS: Record<string, L> = {
  pending: { en: "Pending payment", bn: "পেমেন্ট বাকি", ja: "支払い待ち" },
  paid: { en: "Paid", bn: "পরিশোধিত", ja: "支払い済み" },
  processing: { en: "Processing", bn: "প্রক্রিয়াধীন", ja: "処理中" },
  shipped: { en: "Shipped", bn: "পাঠানো হয়েছে", ja: "発送済み" },
  delivered: { en: "Delivered", bn: "ডেলিভার হয়েছে", ja: "配達完了" },
  cancelled: { en: "Cancelled", bn: "বাতিল", ja: "キャンセル" },
  refunded: { en: "Refunded", bn: "রিফান্ড", ja: "返金済み" },
};

const CASE_STATUS: Record<string, L> = {
  new: { en: "Received", bn: "গৃহীত", ja: "受付済み" },
  reviewing: { en: "Under review", bn: "পর্যালোচনাধীন", ja: "審査中" },
  quoted: { en: "Quoted", bn: "কোটেশন দেওয়া হয়েছে", ja: "見積もり済み" },
  confirmed: { en: "Confirmed", bn: "নিশ্চিত", ja: "確定" },
  arranging: {
    en: "Arranging travel",
    bn: "ভ্রমণ ব্যবস্থাপনা",
    ja: "渡航手配中",
  },
  in_treatment: { en: "In treatment", bn: "চিকিৎসাধীন", ja: "治療中" },
  follow_up: { en: "Follow-up", bn: "ফলো-আপ", ja: "経過観察" },
  closed: { en: "Closed", bn: "সম্পন্ন", ja: "完了" },
  lost: { en: "Closed", bn: "সম্পন্ন", ja: "終了" },
};

function statusLabel(map: Record<string, L>, status: string, locale: Locale) {
  const l = map[status];
  return l ? pick(l, locale) : status;
}

/* ── Catalog search ──────────────────────────────────────────────────────── */

const GROUP_META: Record<string, L> = {
  medtrade: { en: "Medtrade", bn: "মেডট্রেড", ja: "Medtrade" },
  kart: { en: "Spiber Kart", bn: "স্পাইবার কার্ট", ja: "Spiber Kart" },
  academy: { en: "MedAcademy", bn: "মেডএকাডেমি", ja: "MedAcademy" },
  digihealth: { en: "Digihealth", bn: "ডিজিহেলথ", ja: "Digihealth" },
  blog: { en: "Blog", bn: "ব্লগ", ja: "ブログ" },
};

export type SearchToolResult = { cards: ChatCard[]; total: number };

/**
 * Search the unified catalog and return up to `limit` cards across divisions.
 * Marketplace products in stock with a resolvable base price get an in-chat
 * "Add to cart" action; everything else links to its detail page.
 */
export async function searchCatalog(
  query: string,
  locale: Locale,
  limit = 6,
): Promise<SearchToolResult> {
  const q = query.trim();
  if (q.length < 2) return { cards: [], total: 0 };
  let r;
  try {
    r = await searchAll(q, { perGroup: 3 });
  } catch (e) {
    logger.warn("chat searchCatalog failed", e);
    return { cards: [], total: 0 };
  }

  const cards: ChatCard[] = [];
  const total =
    r.products.total +
    r.marketplace.total +
    r.courses.total +
    r.software.total +
    r.posts.total;

  for (const p of r.marketplace.items) {
    const base = p.priceMinor;
    const inStock = (p.stockQty ?? 0) > 0;
    cards.push({
      kind: "product",
      title: localize(p.name, locale),
      subtitle: marketplacePrice(base, p.variants, locale),
      image: p.images?.[0] ?? null,
      href: `${ROUTES.kart}/product/${p.slug}`,
      meta: pick(GROUP_META.kart, locale),
      // Only offer add-to-cart when there's a base price and no required
      // variant selection (variant products route to the detail buy-box).
      actions:
        base != null && base > 0 && inStock && (p.variants?.length ?? 0) === 0
          ? [
              {
                type: "add_to_cart",
                label: pick(LABELS.addToCart, locale),
                productId: String(p._id),
              },
            ]
          : undefined,
    });
  }
  for (const p of r.products.items) {
    cards.push({
      kind: "product",
      title: localize(p.name, locale),
      subtitle: priceLabel(p.priceMinor, locale),
      image: p.images?.[0] ?? null,
      href: `${ROUTES.medtrade}/product/${p.slug}`,
      meta: pick(GROUP_META.medtrade, locale),
    });
  }
  for (const c of r.courses.items) {
    cards.push({
      kind: "course",
      title: localize(c.title, locale),
      subtitle: priceLabel(c.priceMinor, locale),
      image: c.thumbnail ?? null,
      href: `${ROUTES.academy}/course/${c.slug}`,
      meta: pick(GROUP_META.academy, locale),
    });
  }
  for (const s of r.software.items) {
    cards.push({
      kind: "software",
      title: localize(s.name, locale),
      subtitle:
        s.pricingModel === "quote"
          ? pick(PRICE.onRequest, locale)
          : priceLabel(s.priceMinor, locale),
      image: s.screenshots?.[0] ?? null,
      href: `${ROUTES.digihealth}/product/${s.slug}`,
      meta: pick(GROUP_META.digihealth, locale),
    });
  }
  for (const post of r.posts.items) {
    cards.push({
      kind: "post",
      title: localize(post.title, locale),
      image: post.coverImage ?? null,
      href: `${ROUTES.blog}/${post.slug}`,
      meta: pick(GROUP_META.blog, locale),
    });
  }

  return { cards: cards.slice(0, limit), total };
}

/* ── Order status ────────────────────────────────────────────────────────── */

export async function lookupOrder(
  orderNumber: string,
  email: string,
  locale: Locale,
): Promise<ChatCard | null> {
  let order;
  try {
    order = await findOrderForGuest(orderNumber.trim(), email.trim());
  } catch (e) {
    logger.warn("chat lookupOrder failed", e);
    return null;
  }
  if (!order) return null;

  const dateFmt = new Intl.DateTimeFormat(bcp47(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const itemCount = order.items?.length ?? 0;
  const subtitle = [
    statusLabel(ORDER_STATUS, order.status, locale),
    formatBDT(order.totalMinor, locale),
    itemCount ? `${itemCount}×` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "order",
    title: order.orderNumber,
    subtitle,
    meta: order.createdAt
      ? dateFmt.format(new Date(order.createdAt))
      : undefined,
  };
}

/* ── Medical-tourism case status ─────────────────────────────────────────── */

export async function lookupCase(
  caseNumber: string,
  email: string,
  locale: Locale,
): Promise<ChatCard | null> {
  let c;
  try {
    c = await getMedicalCaseByNumber(caseNumber.trim(), email.trim());
  } catch (e) {
    logger.warn("chat lookupCase failed", e);
    return null;
  }
  if (!c) return null;

  const parts = [statusLabel(CASE_STATUS, c.status, locale)];
  if (c.quotation?.amountMinor != null) {
    parts.push(formatBDT(c.quotation.amountMinor, locale));
  }
  return {
    kind: "case",
    title: c.caseNumber,
    subtitle: parts.join(" · "),
    meta: c.requestedService ?? undefined,
  };
}
