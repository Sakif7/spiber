import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Brand, type IBrand } from "@/lib/models/brand";
import { Category, type ICategory } from "@/lib/models/category";
import type { Lean } from "@/lib/models/_shared";
import type { Storefront } from "@/lib/schemas/catalog";

export type CategoryNode = Lean<ICategory> & { children: CategoryNode[] };

// ---- Brands ----
export async function listBrands() {
  await connectToDatabase();
  return Brand.find({ deletedAt: null })
    .sort({ position: 1, "name.en": 1 })
    .lean<Lean<IBrand>[]>()
    .exec();
}
export async function getBrandBySlug(slug: string) {
  await connectToDatabase();
  return Brand.findOne({ slug, deletedAt: null }).lean<Lean<IBrand>>().exec();
}
export async function getBrandById(id: string) {
  await connectToDatabase();
  return Brand.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IBrand>>()
    .exec();
}
export async function createBrand(data: Partial<IBrand>) {
  await connectToDatabase();
  // Append to the end of the manual order unless a position was supplied.
  if (data.position == null) {
    const last = await Brand.findOne({ deletedAt: null })
      .sort({ position: -1 })
      .select("position")
      .lean<{ position?: number }>()
      .exec();
    data = { ...data, position: (last?.position ?? -1) + 1 };
  }
  return Brand.create(data);
}

/** Manual up/down reorder for the admin brand list. */
export async function reorderBrands(
  updates: { id: string; position: number }[],
) {
  await connectToDatabase();
  await Promise.all(
    updates.map((u) =>
      Brand.updateOne({ _id: u.id }, { $set: { position: u.position } }).exec(),
    ),
  );
}
export async function updateBrand(id: string, data: Partial<IBrand>) {
  await connectToDatabase();
  return Brand.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteBrand(id: string) {
  await connectToDatabase();
  await Brand.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}

// ---- Categories ----
export async function listCategories(storefront?: Storefront) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (storefront) q.storefront = storefront;
  return Category.find(q)
    .sort({ position: 1, "name.en": 1 })
    .lean<Lean<ICategory>[]>()
    .exec();
}
export async function getCategoryBySlug(slug: string, storefront?: Storefront) {
  await connectToDatabase();
  const q: Record<string, unknown> = { slug, deletedAt: null };
  if (storefront) q.storefront = storefront;
  return Category.findOne(q).lean<Lean<ICategory>>().exec();
}

/** Nested tree (roots → children) for a storefront, ordered by position. */
export async function listCategoryTree(
  storefront: Storefront,
): Promise<CategoryNode[]> {
  const flat = await listCategories(storefront);
  const byId = new Map<string, CategoryNode>();
  for (const c of flat) byId.set(String(c._id), { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.parentId ? String(node.parentId) : null;
    const parent = parentId ? byId.get(parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * A category id plus all of its descendant ids (within a storefront) — used so a
 * category listing page includes products filed under subcategories.
 */
export async function categoryWithDescendantIds(
  rootId: string,
  storefront?: Storefront,
): Promise<string[]> {
  const flat = await listCategories(storefront);
  const childrenByParent = new Map<string, string[]>();
  for (const c of flat) {
    const pid = c.parentId ? String(c.parentId) : null;
    if (!pid) continue;
    const arr = childrenByParent.get(pid) ?? [];
    arr.push(String(c._id));
    childrenByParent.set(pid, arr);
  }
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop() as string;
    ids.push(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return ids;
}
export async function getCategoryById(id: string) {
  await connectToDatabase();
  return Category.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ICategory>>()
    .exec();
}

/**
 * Effective per-category seller-commission rate: the category's own
 * `sellerCommissionBp`, else the nearest ancestor's (rates are usually set on
 * top-level categories), else null → the caller falls back to the platform
 * default. Ancestor walk is bounded so a cyclic parentId can never hang.
 */
export async function resolveCategoryCommissionBp(
  categoryId: string,
): Promise<number | null> {
  await connectToDatabase();
  let currentId: string | null = categoryId;
  for (let depth = 0; depth < 6 && currentId; depth++) {
    const cat: Lean<ICategory> | null = await Category.findOne({
      _id: currentId,
      deletedAt: null,
    })
      .select("sellerCommissionBp parentId")
      .lean<Lean<ICategory>>()
      .exec()
      .catch(() => null);
    if (!cat) return null;
    if (typeof cat.sellerCommissionBp === "number")
      return cat.sellerCommissionBp;
    currentId = cat.parentId ? String(cat.parentId) : null;
  }
  return null;
}

/**
 * Roll leaf-level product counts up the category tree (pure): each category's
 * total = its own count + all descendants'. Products live on leaf categories,
 * so the filter sidebar's top-level rows need the rolled-up number.
 */
export function rollupCategoryCounts(
  flat: Pick<Lean<ICategory>, "_id" | "parentId">[],
  leafCounts: Record<string, number>,
): Record<string, number> {
  const parentOf = new Map(
    flat.map((c) => [String(c._id), c.parentId ? String(c.parentId) : null]),
  );
  const totals: Record<string, number> = {};
  for (const [id, n] of Object.entries(leafCounts)) {
    let cur: string | null = id;
    // Bounded walk so a cyclic parentId can never hang.
    for (let depth = 0; depth < 8 && cur; depth++) {
      totals[cur] = (totals[cur] ?? 0) + n;
      cur = parentOf.get(cur) ?? null;
    }
  }
  return totals;
}

/** Admin bulk-set of per-category commission rates (null clears → inherit). */
export async function setCategoryCommissionRates(
  rates: { categoryId: string; commissionBp: number | null }[],
): Promise<number> {
  await connectToDatabase();
  let updated = 0;
  for (const r of rates) {
    if (!mongoose.isValidObjectId(r.categoryId)) continue;
    const res = await Category.updateOne(
      { _id: r.categoryId, deletedAt: null },
      { $set: { sellerCommissionBp: r.commissionBp } },
    ).exec();
    updated += res.modifiedCount ?? 0;
  }
  return updated;
}
export async function createCategory(data: Partial<ICategory>) {
  await connectToDatabase();
  // Append to the end of its sibling group unless a position was supplied, so a
  // new (sub)category sorts last rather than tying at 0 with its siblings.
  if (data.position == null) {
    const last = await Category.findOne({
      deletedAt: null,
      storefront: data.storefront,
      parentId: data.parentId ?? null,
    })
      .sort({ position: -1 })
      .select("position")
      .lean<{ position?: number }>()
      .exec();
    data = { ...data, position: (last?.position ?? -1) + 1 };
  }
  return Category.create(data);
}
export async function updateCategory(id: string, data: Partial<ICategory>) {
  await connectToDatabase();
  return Category.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteCategory(id: string) {
  await connectToDatabase();
  await Category.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}

/** Bulk reparent/reorder for the admin category tree manager. */
export async function reorderCategories(
  updates: { id: string; parentId?: string | null; position: number }[],
) {
  await connectToDatabase();
  await Promise.all(
    updates.map((u) =>
      Category.updateOne(
        { _id: u.id },
        {
          $set: {
            parentId: u.parentId ? u.parentId : null,
            position: u.position,
          },
        },
      ).exec(),
    ),
  );
}
