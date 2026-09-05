import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { Quotation } from "@/lib/models/quotation";
import { User } from "@/lib/models/user";
import { Seller } from "@/lib/models/seller";
import { MedicalCase } from "@/lib/models/medicalCase";
import { Appointment } from "@/lib/models/appointment";
import { listProducts } from "@/lib/repositories/products.repo";
import { partialMatchFilter } from "@/lib/repositories/search-filter";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import {
  ADMIN_SEARCH_GROUP_LABELS,
  type AdminSearchGroup,
  type AdminSearchGroupKey,
  type AdminSearchHit,
  type AdminSearchResponse,
} from "@/lib/search/admin-dto";

const STORE_LABEL: Record<string, string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
};

/**
 * Each record type is searched in isolation: a failing collection degrades
 * that one group to empty instead of failing the whole palette query.
 */
async function slice(
  key: AdminSearchGroupKey,
  run: () => Promise<AdminSearchHit[]>,
): Promise<AdminSearchGroup> {
  try {
    return { key, label: ADMIN_SEARCH_GROUP_LABELS[key], hits: await run() };
  } catch (e) {
    logger.warn(`admin search slice failed: ${key}`, e);
    return { key, label: ADMIN_SEARCH_GROUP_LABELS[key], hits: [] };
  }
}

/** Case-insensitive substring filter (every term must match some field). */
function match(term: string, fields: string[]): Record<string, unknown> {
  return partialMatchFilter(term, fields) ?? {};
}

/**
 * Admin command-palette record search: orders, quotations, products (both
 * stores, incl. drafts and seller listings awaiting review), customer
 * accounts, sellers, medical cases and appointments — `perGroup` hits each,
 * newest first, pre-formatted for rendering. Admin-only; the caller guards.
 */
export async function searchAdminRecords(
  query: string,
  opts: { perGroup?: number } = {},
): Promise<AdminSearchResponse> {
  const q = query.trim();
  if (q.length < 2) return { query: q, total: 0, groups: [] };
  const perGroup = Math.min(10, Math.max(1, opts.perGroup ?? 5));
  await connectToDatabase();

  const groups = await Promise.all([
    slice("orders", async () => {
      const rows = await Order.find(match(q, ["orderNumber", "email"]))
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("orderNumber email totalMinor status storefront")
        .lean()
        .exec();
      return rows.map((o) => ({
        id: String(o._id),
        group: "orders" as const,
        title: o.orderNumber,
        subtitle: `${o.email} · ${STORE_LABEL[o.storefront] ?? o.storefront} · ${formatBDT(o.totalMinor, "en")}`,
        badge: o.status,
        href: `/admin/orders/${String(o._id)}`,
      }));
    }),

    slice("quotations", async () => {
      const rows = await Quotation.find({
        deletedAt: null,
        ...match(q, [
          "quotationNumber",
          "contact.name",
          "contact.email",
          "contact.organization",
        ]),
      })
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("quotationNumber contact status")
        .lean()
        .exec();
      return rows.map((r) => ({
        id: String(r._id),
        group: "quotations" as const,
        title: r.quotationNumber,
        subtitle: [r.contact?.name, r.contact?.organization]
          .filter(Boolean)
          .join(" · "),
        badge: r.status,
        href: `/admin/quotations/${String(r._id)}`,
      }));
    }),

    slice("products", async () => {
      const res = await listProducts({
        search: q,
        pageSize: perGroup,
        includeUnapproved: true,
      });
      return res.items.map((p) => ({
        id: String(p._id),
        group: "products" as const,
        title: localize(p.name, "en"),
        subtitle: [
          p.sku,
          STORE_LABEL[p.storefront] ?? p.storefront,
          p.sellerId ? "Seller listing" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        badge: p.status,
        href:
          p.storefront === "marketplace"
            ? `/admin/marketplace/products/${String(p._id)}`
            : `/admin/products/${String(p._id)}`,
      }));
    }),

    slice("customers", async () => {
      const rows = await User.find(match(q, ["name", "email"]))
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("name email roles disabled")
        .lean()
        .exec();
      // There is no admin customer page; a customer's orders is the useful
      // landing (the orders list honours `?q=`).
      return rows.map((u) => ({
        id: String(u._id),
        group: "customers" as const,
        title: u.name,
        subtitle: `${u.email} · ${u.roles.join(", ")}`,
        badge: u.disabled ? "disabled" : undefined,
        href: `/admin/orders?q=${encodeURIComponent(u.email)}`,
      }));
    }),

    slice("sellers", async () => {
      const rows = await Seller.find({
        deletedAt: null,
        ...match(q, ["displayName", "slug"]),
      })
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("displayName slug status")
        .lean()
        .exec();
      return rows.map((s) => ({
        id: String(s._id),
        group: "sellers" as const,
        title: s.displayName,
        subtitle: `/kart/seller/${s.slug}`,
        badge: s.status,
        href: `/admin/sellers/${String(s._id)}`,
      }));
    }),

    slice("cases", async () => {
      const rows = await MedicalCase.find({
        deletedAt: null,
        ...match(q, ["caseNumber", "patient.name", "patient.email"]),
      })
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("caseNumber patient.name patient.country status")
        .lean()
        .exec();
      return rows.map((c) => ({
        id: String(c._id),
        group: "cases" as const,
        title: c.caseNumber,
        subtitle: [c.patient?.name, c.patient?.country]
          .filter(Boolean)
          .join(" · "),
        badge: c.status,
        href: `/admin/tourism/cases/${String(c._id)}`,
      }));
    }),

    slice("appointments", async () => {
      const rows = await Appointment.find({
        deletedAt: null,
        ...match(q, ["appointmentNumber", "patient.name", "patient.email"]),
      })
        .sort({ createdAt: -1 })
        .limit(perGroup)
        .select("appointmentNumber patient.name patient.email status")
        .lean()
        .exec();
      return rows.map((a) => ({
        id: String(a._id),
        group: "appointments" as const,
        title: a.appointmentNumber,
        subtitle: [a.patient?.name, a.patient?.email]
          .filter(Boolean)
          .join(" · "),
        badge: a.status,
        href: `/admin/tourism/appointments/${String(a._id)}`,
      }));
    }),
  ]);

  const nonEmpty = groups.filter((g) => g.hits.length > 0);
  return {
    query: q,
    total: nonEmpty.reduce((n, g) => n + g.hits.length, 0),
    groups: nonEmpty,
  };
}
