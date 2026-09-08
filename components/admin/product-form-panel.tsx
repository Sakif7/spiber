"use client";

import { ProductForm, type ProductFormInitial } from "./product-form";
import {
  MarketplaceProductForm,
  type MarketplaceProductInitial,
} from "./marketplace-product-form";
import { useRecord, RecordPending } from "@/components/admin/ui/use-record";

type Option = { id: string; name: string };
type CatOption = { id: string; name: string; parentId: string | null };

/**
 * A product editor in a panel, for either storefront. The record is fetched on
 * open because variants and specs make these documents too heavy to carry on
 * every row of the list.
 */
export function ProductFormPanel({
  id,
  storefront,
  categories,
  brands,
}: {
  id: string;
  storefront: "instruments" | "marketplace";
  categories: CatOption[];
  brands: Option[];
}) {
  const { data, error } = useRecord<
    ProductFormInitial | MarketplaceProductInitial
  >(`/api/admin/products/${id}`);
  if (!data) return <RecordPending error={error} />;
  return storefront === "marketplace" ? (
    <MarketplaceProductForm
      initial={data as MarketplaceProductInitial}
      categories={categories}
      brands={brands}
    />
  ) : (
    <ProductForm
      initial={data as ProductFormInitial}
      categories={categories}
      brands={brands}
    />
  );
}
