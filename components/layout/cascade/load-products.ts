import type { CascadeNode } from "./cascade";

type MiniProduct = { slug: string; name: string; image: string | null };

// Module-level cache so product columns aren't re-fetched across panel opens.
const cache = new Map<string, CascadeNode[]>();

/**
 * Fetch products for a cascade leaf column (shared by the Instruments and
 * Marketplace menus). `qs` carries the filter (`categoryId=…` / `brandId=…` and
 * optionally `storefront=marketplace`); `hrefBase` is the product detail base.
 * Cached per (locale, qs). Never throws — returns [] on failure.
 */
export function loadCatalogProducts(
  locale: string,
  qs: string,
  hrefBase: string,
): Promise<CascadeNode[]> {
  const key = `${locale}|${qs}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  return fetch(`/api/catalog/products?locale=${locale}&${qs}`)
    .then((r) => r.json())
    .then((j) => {
      const list: MiniProduct[] = j?.ok ? j.data.products : [];
      const nodes: CascadeNode[] = list.map((p) => ({
        id: p.slug,
        label: p.name,
        kind: "product",
        href: `${hrefBase}/${p.slug}`,
        image: p.image,
      }));
      cache.set(key, nodes);
      return nodes;
    })
    .catch(() => []);
}
