import type { ListQuery } from "@/lib/admin/list-params";
import type { ProductSort } from "@/lib/repositories/products.repo";

/** Kit sort key + direction → the product repo's own sort enum. */
export function productSortFor(
  query: Pick<ListQuery, "sort" | "dir">,
): ProductSort {
  if (query.sort === "name") {
    return query.dir === "asc" ? "name_asc" : "name_desc";
  }
  if (query.sort === "price") {
    return query.dir === "asc" ? "price_asc" : "price_desc";
  }
  return "newest";
}
