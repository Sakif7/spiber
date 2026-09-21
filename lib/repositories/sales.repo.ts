import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { SalesLead, type ISalesLead } from "@/lib/models/salesLead";
import { SalesOrder, type ISalesOrder } from "@/lib/models/salesOrder";
import type { SalesOrderStatus } from "@/lib/schemas/sales-order";
import { InventoryMovement } from "@/lib/models/inventoryMovement";
import { Product } from "@/lib/models/product";
import { Brand } from "@/lib/models/brand";
import type { Lean } from "@/lib/models/_shared";
import {
  sortSpec,
  applyDateRange,
  paginate,
  type Paged,
  type RepoListQuery,
} from "@/lib/repositories/list-query";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

const oid = (id: string) => new mongoose.Types.ObjectId(id);

// ────────────────────────────── leads ──────────────────────────────

const LEAD_SORT: Record<string, string> = {
  date: "createdAt",
  organisation: "organisation",
  status: "status",
  activity: "lastActivityAt",
  code: "code",
  area: "area",
};

export type LeadListParams = RepoListQuery & {
  status?: string;
  /** District slug. */
  area?: string;
  /** `client` = has paid at least one invoice; `lead` = has not, yet. */
  type?: string;
  /** One of the lead-reason enum values. */
  reason?: string;
};

/**
 * The leads that have paid us.
 *
 * A client is not a flag someone sets — it is a fact about their orders, so it
 * is derived every time rather than stored. That way it can never be wrong,
 * and reversing a payment takes the badge away by itself.
 */
export async function paidLeadIds(): Promise<string[]> {
  await connectToDatabase();
  const ids = await SalesOrder.distinct("leadId", {
    "payment.status": "paid",
    deletedAt: null,
  }).exec();
  return (ids as mongoose.Types.ObjectId[]).map(String);
}

export async function listSalesLeads(
  params: LeadListParams = {},
): Promise<Paged<ISalesLead>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.status && params.status !== "all") filter.status = params.status;
  if (params.area && params.area !== "all") filter.area = params.area;
  if (params.reason && params.reason !== "all") filter.reasons = params.reason;
  if (params.type === "client" || params.type === "lead") {
    const paid = (await paidLeadIds()).map(oid);
    filter._id = params.type === "client" ? { $in: paid } : { $nin: paid };
  }
  applyPartialSearch(filter, params.search, [
    "organisation",
    "code",
    "contactName",
    "phone",
    "email",
    "leadNumber",
    "sourceName",
  ]);
  applyDateRange(filter, params.from, params.to);
  return paginate<ISalesLead>(SalesLead, filter, {
    sort: sortSpec(params.sort, params.dir, LEAD_SORT),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function getSalesLeadById(
  id: string,
): Promise<Lean<ISalesLead> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return SalesLead.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ISalesLead>>()
    .exec();
}

export async function createSalesLead(data: Partial<ISalesLead>) {
  await connectToDatabase();
  return SalesLead.create(data);
}

export async function updateSalesLead(
  id: string,
  patch: Partial<ISalesLead>,
): Promise<Lean<ISalesLead> | null> {
  await connectToDatabase();
  return SalesLead.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: patch },
    { returnDocument: "after" },
  )
    .lean<Lean<ISalesLead>>()
    .exec();
}

export async function softDeleteSalesLead(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await SalesLead.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return res.matchedCount > 0;
}

export async function addLeadActivity(
  id: string,
  entry: {
    authorId: string;
    body: string;
    from?: string | null;
    to?: string | null;
  },
): Promise<void> {
  await connectToDatabase();
  const at = new Date();
  await SalesLead.updateOne(
    { _id: id },
    {
      $push: { activity: { ...entry, authorId: oid(entry.authorId), at } },
      $set: { lastActivityAt: at },
    },
  ).exec();
}

/** Is this client code free? Codes appear on invoices, so they must be unique. */
export async function leadCodeTaken(
  code: string,
  exceptId?: string,
): Promise<boolean> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    code: code.toUpperCase(),
    deletedAt: null,
  };
  if (exceptId) q._id = { $ne: oid(exceptId) };
  return (await SalesLead.countDocuments(q).exec()) > 0;
}

// ────────────────────────── sales orders ──────────────────────────

const ORDER_SORT: Record<string, string> = {
  date: "createdAt",
  number: "number",
  organisation: "leadSnapshot.organisation",
  status: "status",
  total: "totalMinor",
  invoice: "invoiceNumber",
};

export type SalesOrderListParams = RepoListQuery & {
  status?: string;
  payment?: string;
  leadId?: string;
  /** "consumables" | "equipment"; anything else lists both. */
  kind?: string;
};

export async function listSalesOrders(
  params: SalesOrderListParams = {},
): Promise<Paged<ISalesOrder>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.status && params.status !== "all") filter.status = params.status;
  if (params.payment && params.payment !== "all") {
    filter["payment.status"] = params.payment;
  }
  if (params.kind === "equipment") filter.kind = "equipment";
  // Orders raised before the kind existed have no field at all, and every
  // one of them is consumables: null inside $in matches the absent field.
  if (params.kind === "consumables")
    filter.kind = { $in: ["consumables", null] };
  if (params.leadId && mongoose.isValidObjectId(params.leadId)) {
    filter.leadId = oid(params.leadId);
  }
  applyPartialSearch(filter, params.search, [
    "number",
    "invoiceNumber",
    "leadSnapshot.organisation",
    "leadSnapshot.code",
    "leadSnapshot.contactName",
  ]);
  applyDateRange(filter, params.from, params.to);
  return paginate<ISalesOrder>(SalesOrder, filter, {
    sort: sortSpec(params.sort, params.dir, ORDER_SORT),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function getSalesOrderById(
  id: string,
): Promise<Lean<ISalesOrder> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return SalesOrder.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ISalesOrder>>()
    .exec();
}

export async function createSalesOrder(data: Partial<ISalesOrder>) {
  await connectToDatabase();
  return SalesOrder.create(data);
}

export async function updateSalesOrder(
  id: string,
  patch: Record<string, unknown>,
): Promise<Lean<ISalesOrder> | null> {
  await connectToDatabase();
  return SalesOrder.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: patch },
    { returnDocument: "after" },
  )
    .lean<Lean<ISalesOrder>>()
    .exec();
}

/**
 * Move the order to `to` only if it is still in `from`.
 *
 * The compare-and-set matters: invoicing reserves stock first and only then
 * changes the status, so if another admin moved the order in between, this
 * fails and the caller releases what it reserved instead of double-committing.
 */
export async function transitionSalesOrderIfCurrent(
  id: string,
  from: SalesOrderStatus,
  to: SalesOrderStatus,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  await connectToDatabase();
  const res = await SalesOrder.updateOne(
    { _id: id, status: from, deletedAt: null } as Record<string, unknown>,
    { $set: { status: to, ...extra } },
  ).exec();
  return res.matchedCount > 0;
}

export async function addSalesOrderActivity(
  id: string,
  entry: {
    authorId?: string | null;
    body: string;
    from?: string | null;
    to?: string | null;
  },
): Promise<void> {
  await connectToDatabase();
  await SalesOrder.updateOne(
    { _id: id },
    {
      $push: {
        activity: {
          authorId: entry.authorId ? oid(entry.authorId) : null,
          body: entry.body,
          at: new Date(),
          from: entry.from ?? null,
          to: entry.to ?? null,
        },
      },
    },
  ).exec();
}

/** Record that a document version was emailed, without touching the snapshot. */
export async function markVersionEmailed(
  id: string,
  kind: "proposals" | "invoices" | "challans",
  version: number,
  to: string,
  by: string,
): Promise<void> {
  await connectToDatabase();
  await SalesOrder.updateOne(
    { _id: id, [`${kind}.version`]: version },
    {
      $set: {
        [`${kind}.$.emailedAt`]: new Date(),
        [`${kind}.$.emailedBy`]: oid(by),
      },
      $addToSet: { [`${kind}.$.emailedTo`]: to },
    },
  ).exec();
}

/**
 * What this order still holds in inventory, taken from the movement ledger
 * rather than the order's own line items.
 *
 * The ledger is the authoritative record of what was actually reserved: if an
 * amendment failed halfway, or a line was removed after reserving, the ledger
 * still knows what has to be given back.
 */
export async function outstandingReservations(
  salesOrderId: string,
): Promise<{ productId: string; variantId: string | null; qty: number }[]> {
  await connectToDatabase();
  const rows = await InventoryMovement.aggregate<{
    _id: { productId: mongoose.Types.ObjectId; variantId: string | null };
    qty: number;
  }>([
    { $match: { refSalesOrderId: oid(salesOrderId) } },
    {
      $group: {
        _id: { productId: "$productId", variantId: "$variantId" },
        qty: { $sum: "$reservedDelta" },
      },
    },
    { $match: { qty: { $gt: 0 } } },
  ]);
  return rows.map((r) => ({
    productId: String(r._id.productId),
    variantId: r._id.variantId ?? null,
    qty: r.qty,
  }));
}

export async function countSalesOrdersByStatus(
  status: SalesOrderStatus,
): Promise<number> {
  await connectToDatabase();
  return SalesOrder.countDocuments({
    status,
    deletedAt: null,
  } as Record<string, unknown>).exec();
}

/** Invoiced orders that are still unpaid — the dashboard's "needs attention". */
export async function countUnpaidInvoices(): Promise<number> {
  await connectToDatabase();
  return SalesOrder.countDocuments({
    deletedAt: null,
    status: { $in: ["invoiced", "delivered"] },
    "payment.status": "unpaid",
  } as Record<string, unknown>).exec();
}

// ─────────────────────── sales line prefill ───────────────────────

/**
 * The catalogue detail a sales line needs, which the stock-unit list does not
 * carry: it is an inventory view and stops at `brandId`.
 *
 * The proposal and invoice tables print Item Description, Brand/Origin and
 * Specification per line, and those map onto the catalogue the way the client's
 * own spreadsheet import did: description is the equipment TYPE, the product
 * name is the MODEL, and country of origin lives in a spec because Brand has no
 * origin field.
 */
export type SalesLineDetail = {
  description: string;
  specification: string;
  brandOrigin: string;
  /** The two halves of "Brand / Origin" on their own, for an equipment line. */
  brand: string;
  origin: string;
  /** What a unit costs us, to prefill the line's cost. Null if never set. */
  costPriceMinor: number | null;
};

/**
 * What the catalogue asks for these products today.
 *
 * Used when an order is repeated: the copy keeps the price that was agreed
 * last time, and the admin is told which lines the catalogue has since moved
 * away from. Silently re-pricing would change a deal nobody renegotiated;
 * silently keeping an old price would sell at last year's rate.
 */
export async function currentProductPrices(
  productIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const ids = [
    ...new Set(productIds.filter((id) => mongoose.isValidObjectId(id))),
  ];
  if (!ids.length) return out;

  await connectToDatabase();
  const products = await Product.find({ _id: { $in: ids.map(oid) } })
    .select("priceMinor variants")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        priceMinor?: number | null;
        variants?: { id: string; priceMinorOverride?: number | null }[];
      }[]
    >()
    .exec();

  for (const p of products) {
    out.set(String(p._id), p.priceMinor ?? null);
    for (const v of p.variants ?? []) {
      out.set(
        `${String(p._id)}:${v.id}`,
        v.priceMinorOverride ?? p.priceMinor ?? null,
      );
    }
  }
  return out;
}

export async function salesLineDetails(
  productIds: string[],
): Promise<Map<string, SalesLineDetail>> {
  const out = new Map<string, SalesLineDetail>();
  const ids = [
    ...new Set(productIds.filter((id) => mongoose.isValidObjectId(id))),
  ];
  if (!ids.length) return out;

  await connectToDatabase();
  const products = await Product.find({ _id: { $in: ids.map(oid) } })
    .select("name description specs brandId costPriceMinor")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        name?: { en?: string };
        description?: { en?: string };
        specs?: { key?: { en?: string }; value?: { en?: string } }[];
        brandId?: mongoose.Types.ObjectId | null;
        costPriceMinor?: number | null;
      }[]
    >()
    .exec();

  const brandIds = [
    ...new Set(
      products
        .map((p) => p.brandId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const brands = brandIds.length
    ? await Brand.find({ _id: { $in: brandIds.map(oid) } })
        .select("name")
        .lean<{ _id: mongoose.Types.ObjectId; name?: { en?: string } }[]>()
        .exec()
    : [];
  const brandName = new Map(
    brands.map((b) => [String(b._id), (b.name?.en ?? "").trim()]),
  );

  for (const p of products) {
    const name = (p.name?.en ?? "").trim();
    const description = (p.description?.en ?? "").trim();
    const specs = (p.specs ?? []).map((s) => ({
      key: (s.key?.en ?? "").trim(),
      value: (s.value?.en ?? "").trim(),
    }));
    const origin =
      specs.find((s) => s.key.toLowerCase() === "country of origin")?.value ??
      "";
    const brand = p.brandId ? (brandName.get(String(p.brandId)) ?? "") : "";

    // Country of origin is printed in Brand/Origin, so it must not appear a
    // second time in Specification.
    const printableSpecs = specs
      .filter(
        (s) => s.key && s.value && s.key.toLowerCase() !== "country of origin",
      )
      .map((s) => `${s.key}: ${s.value}`);

    out.set(String(p._id), {
      // The NAME is the product's identity — for the client's catalogue it is
      // the model, which is what a buyer matches against a quotation. This used
      // to be `description || name`, which printed the storefront's marketing
      // blurb ("A quality product available on the Spiber Marketplace.") for
      // anything that had one, and duplicated the name into both columns for
      // anything that did not.
      costPriceMinor: p.costPriceMinor ?? null,
      description: name || description,
      // Real specs first; the catalogue description is the equipment TYPE and
      // is the honest fallback. Never the name again — that is the column to
      // the left.
      specification: printableSpecs.join(" · ") || description,
      // "Brand / Origin" matches the printed column; either half may be absent.
      // Brand is resolved from the master Brand collection via `brandId`, so a
      // product with no brand assigned prints blank rather than guessing.
      brandOrigin: [brand, origin].filter(Boolean).join(" / "),
      brand,
      origin,
    });
  }
  return out;
}
