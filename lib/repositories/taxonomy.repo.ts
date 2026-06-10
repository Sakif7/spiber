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
