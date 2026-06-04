import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";

/**
 * Admin "hard delete" — irreversibly removes documents, for cleaning test data
 * on a live deployment. The rest of the app uses SOFT delete (deletedAt); this
 * is a deliberate, guarded escape hatch (admin-only, audited, type-to-confirm
 * for bulk purges). `users` and `audit_logs` are intentionally NOT deletable
 * here (locking yourself out / destroying the audit trail). For a full reset
 * use `npm run reset-seed`.
 */

export type DeletableCollection = {
  name: string;
  label: string;
  /** Soft-deletable models also support "purge only the soft-deleted rows". */
  softDelete: boolean;
};

export const DELETABLE_COLLECTIONS: DeletableCollection[] = [
  {
    name: "products",
    label: "Products (Instruments + Marketplace)",
    softDelete: true,
  },
  { name: "categories", label: "Categories", softDelete: true },
  { name: "brands", label: "Brands", softDelete: true },
  { name: "orders", label: "Orders", softDelete: false },
  { name: "coupons", label: "Coupons", softDelete: false },
  { name: "quotation_requests", label: "Quotation requests", softDelete: true },
  { name: "quote_lists", label: "Quote lists (RFQ carts)", softDelete: false },
  { name: "carts", label: "Carts", softDelete: false },
  {
    name: "inventory_movements",
    label: "Inventory movements",
    softDelete: false,
  },
  { name: "reviews", label: "Reviews", softDelete: true },
  { name: "marketplace_banners", label: "Banners", softDelete: false },
  { name: "courses", label: "Courses", softDelete: true },
  { name: "enrollments", label: "Enrollments", softDelete: false },
  { name: "software_products", label: "Software products", softDelete: true },
  {
    name: "software_purchases",
    label: "Software purchases",
    softDelete: false,
  },
  { name: "licenses", label: "Licenses", softDelete: false },
  {
    name: "provisioning_tasks",
    label: "Provisioning tasks",
    softDelete: false,
  },
  {
    name: "affiliate_commissions",
    label: "Affiliate commissions",
    softDelete: false,
  },
  { name: "inquiries", label: "Inquiries", softDelete: false },
  { name: "blog_posts", label: "Blog posts", softDelete: true },
  { name: "blog_categories", label: "Blog categories", softDelete: true },
  { name: "blog_tags", label: "Blog tags", softDelete: true },
  { name: "testimonials", label: "Testimonials", softDelete: false },
  { name: "posts", label: "News posts", softDelete: false },
  { name: "newsletter", label: "Newsletter signups", softDelete: false },
  { name: "wishlist_items", label: "Wishlist items", softDelete: false },
];

const BY_NAME = new Map(DELETABLE_COLLECTIONS.map((c) => [c.name, c]));

export function isDeletable(name: string): boolean {
  return BY_NAME.has(name);
}

type Doc = Record<string, unknown> & { _id: unknown };

/** Best-effort human label for an arbitrary document. */
function docLabel(d: Doc): string {
  const localized = (v: unknown) =>
    v && typeof v === "object" && "en" in (v as object)
      ? String((v as { en: unknown }).en ?? "")
      : typeof v === "string"
        ? v
        : "";
  const candidates = [
    localized(d.name),
    localized(d.title),
    d.orderNumber,
    d.quotationNumber,
    d.inquiryNumber,
    d.licenseKey,
    d.code,
    d.sku,
    d.email,
    d.subject,
    d.slug,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim()) return c;
  }
  return String(d._id);
}

function coll(name: string) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("db not connected");
  return db.collection(name);
}

export async function countDeletable(): Promise<
  { name: string; label: string; softDelete: boolean; count: number }[]
> {
  await connectToDatabase();
  return Promise.all(
    DELETABLE_COLLECTIONS.map(async (c) => ({
      ...c,
      count: await coll(c.name).countDocuments({}),
    })),
  );
}

export type RecentRow = {
  id: string;
  label: string;
  createdAt: string | null;
  deleted: boolean;
};

export async function listRecent(
  name: string,
  limit = 25,
): Promise<RecentRow[]> {
  if (!isDeletable(name)) return [];
  await connectToDatabase();
  const rows = await coll(name)
    .find({})
    .sort({ _id: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .toArray();
  return rows.map((d) => ({
    id: String(d._id),
    label: docLabel(d as Doc),
    createdAt: d.createdAt ? new Date(d.createdAt as Date).toISOString() : null,
    deleted: Boolean(d.deletedAt),
  }));
}

export type HardDeleteResult =
  | { ok: true; deletedCount: number; before?: Doc }
  | { ok: false; code: "bad_collection" | "bad_id" | "not_found" };

export async function hardDeleteOne(
  name: string,
  id: string,
): Promise<HardDeleteResult> {
  if (!isDeletable(name)) return { ok: false, code: "bad_collection" };
  if (!mongoose.isValidObjectId(id)) return { ok: false, code: "bad_id" };
  await connectToDatabase();
  const c = coll(name);
  const _id = new mongoose.Types.ObjectId(id);
  const before = (await c.findOne({ _id })) as Doc | null;
  if (!before) return { ok: false, code: "not_found" };
  const res = await c.deleteOne({ _id });
  return { ok: true, deletedCount: res.deletedCount ?? 0, before };
}

export type PurgeResult =
  | { ok: true; deletedCount: number }
  | { ok: false; code: "bad_collection" };

/** Delete every doc in a collection, or (softOnly) just the soft-deleted ones. */
export async function purgeCollection(
  name: string,
  softOnly = false,
): Promise<PurgeResult> {
  if (!isDeletable(name)) return { ok: false, code: "bad_collection" };
  await connectToDatabase();
  const filter = softOnly ? { deletedAt: { $ne: null } } : {};
  const res = await coll(name).deleteMany(filter);
  return { ok: true, deletedCount: res.deletedCount ?? 0 };
}
