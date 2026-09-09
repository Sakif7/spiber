"use client";

import { useState } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import { ImageUploader } from "./image-uploader";
import { SpecsEditor, type SpecRow } from "./specs-editor";
import { VariantsEditor, type VariantsValue } from "./variants-editor";
import { CategorySelect, type CategoryOption } from "./category-select";
import { ProductStockCard } from "./inventory/product-stock-card";
import { LocalizedInput, type LocalizedValue } from "./ui/localized-input";
import { SelectField } from "./ui/select-field";
import {
  EditorForm,
  FormField,
  FormGrid,
  FormSection,
  SaveBar,
} from "./ui/form-shell";

export type MarketplaceProductInitial = {
  id?: string;
  sku?: string;
  slug?: string;
  name?: { en: string; bn?: string; ja?: string };
  description?: { en: string; bn?: string; ja?: string };
  categoryId?: string;
  brandId?: string;
  priceMinor?: number | null;
  compareAtMinor?: number | null;
  costPriceMinor?: number | null;
  lowStockThreshold?: number;
  /** Read-only here — stock is changed in Inventory. */
  stockQty?: number;
  status?: "draft" | "active" | "archived";
  featured?: boolean;
  specs?: SpecRow[];
  images?: string[];
  variantOptions?: VariantsValue["variantOptions"];
  variants?: VariantsValue["variants"];
};

type Option = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export function MarketplaceProductForm({
  initial,
  categories,
  brands,
}: {
  initial?: MarketplaceProductInitial;
  categories: CategoryOption[];
  brands: Option[];
}) {
  const afterSave = useAfterSave();
  const isEdit = Boolean(initial?.id);

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState<LocalizedValue>({
    en: initial?.name?.en ?? "",
    bn: initial?.name?.bn ?? "",
    ja: initial?.name?.ja ?? "",
  });
  const [description, setDescription] = useState<LocalizedValue>({
    en: initial?.description?.en ?? "",
    bn: initial?.description?.bn ?? "",
    ja: initial?.description?.ja ?? "",
  });
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ??
      categories.find((c) => !c.parentId)?.id ??
      categories[0]?.id ??
      "",
  );
  const [brandId, setBrandId] = useState(initial?.brandId ?? "");
  const [price, setPrice] = useState(
    initial?.priceMinor != null ? String(fromMinor(initial.priceMinor)) : "",
  );
  const [compareAt, setCompareAt] = useState(
    initial?.compareAtMinor != null
      ? String(fromMinor(initial.compareAtMinor))
      : "",
  );
  const [costPrice, setCostPrice] = useState(
    initial?.costPriceMinor != null
      ? String(fromMinor(initial.costPriceMinor))
      : "",
  );
  const [lowStock, setLowStock] = useState(
    String(initial?.lowStockThreshold ?? 5),
  );
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [specs, setSpecs] = useState<SpecRow[]>(initial?.specs ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [variantData, setVariantData] = useState<VariantsValue>({
    variantOptions: initial?.variantOptions ?? [],
    variants: initial?.variants ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      storefront: "marketplace" as const,
      sku,
      slug,
      name: {
        en: name.en ?? "",
        bn: name.bn || undefined,
        ja: name.ja || undefined,
      },
      description: description.en
        ? {
            en: description.en,
            bn: description.bn || undefined,
            ja: description.ja || undefined,
          }
        : undefined,
      categoryId,
      brandId: brandId || undefined,
      priceMinor: price.trim() ? toMinor(Number(price) || 0) : null,
      compareAtMinor: compareAt.trim() ? toMinor(Number(compareAt) || 0) : null,
      // Blank clears it: "we have not said" is not "it was free".
      costPriceMinor: costPrice.trim() ? toMinor(Number(costPrice) || 0) : null,
      lowStockThreshold: Number(lowStock) || 0,
      status,
      featured,
      specs: specs.filter((s) => s.key.en && s.value.en),
      images,
      variantOptions: variantData.variantOptions,
      variants: variantData.variants,
    };
    const res = await fetch(
      isEdit ? `/api/admin/products/${initial!.id}` : "/api/admin/products",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      afterSave("/admin/marketplace/products");
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <EditorForm>
      <FormSection
        title="Basics"
        description="What the product is called and where it sits in the catalog."
      >
        <LocalizedInput
          label="Name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g. Omron Digital BP Monitor"
        />
        <FormGrid>
          <FormField label="SKU" htmlFor="kart-sku" required>
            <Input
              id="kart-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor="kart-slug"
            hint="Leave blank to derive it from the English name."
          >
            <Input
              id="kart-slug"
              value={slug}
              placeholder="auto from name"
              onChange={(e) => setSlug(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <LocalizedInput
          label="Description"
          textarea
          value={description}
          onChange={setDescription}
        />
        <FormGrid>
          <FormField label="Category">
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </FormField>
          <FormField label="Brand">
            <SelectField
              value={brandId}
              onChange={setBrandId}
              ariaLabel="Brand"
              emptyLabel="— none —"
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />
          </FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Status">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
            />
          </FormField>
          <FormField label="Visibility">
            <div className="flex h-9 items-center gap-2.5">
              <Switch
                id="kart-featured"
                checked={featured}
                onCheckedChange={setFeatured}
              />
              <Label htmlFor="kart-featured" className="font-normal">
                Featured on the homepage
              </Label>
            </div>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Pricing & stock"
        description="A Spiber Kart product needs a base price, or a price on every variant."
      >
        <FormGrid cols={3}>
          <FormField label="Base price (BDT)" htmlFor="kart-price">
            <Input
              id="kart-price"
              type="number"
              value={price}
              placeholder="Required (or set per variant)"
              onChange={(e) => setPrice(e.target.value)}
            />
          </FormField>
          <FormField
            label="Compare-at / “was” price"
            htmlFor="kart-compare"
            hint="Above the price, shows a Sale badge."
          >
            <Input
              id="kart-compare"
              type="number"
              value={compareAt}
              placeholder="Optional"
              onChange={(e) => setCompareAt(e.target.value)}
            />
          </FormField>
          <FormField
            label="Cost price (BDT, optional)"
            htmlFor="kart-cost"
            hint="What a unit costs us. Drives gross profit on the sales report; an order copies it when it sells."
          >
            <Input
              id="kart-cost"
              type="number"
              value={costPrice}
              placeholder="What we pay for one"
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </FormField>
          <FormField label="Low-stock threshold" htmlFor="kart-low-stock">
            <Input
              id="kart-low-stock"
              type="number"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          </FormField>
        </FormGrid>
        {isEdit && (
          <ProductStockCard
            productId={initial!.id!}
            sku={sku}
            stockQty={initial?.stockQty ?? 0}
            variants={variantData.variants.map((v) => ({
              sku: v.sku,
              label: v.options.map((o) => o.value).join(" ·"),
              stockQty: v.stockQty ?? 0,
            }))}
            tracked
          />
        )}
      </FormSection>

      <FormSection
        title="Media"
        description="The first image is used as the catalog thumbnail."
      >
        <ImageUploader value={images} onChange={setImages} />
      </FormSection>

      <FormSection
        title="Variants"
        description="Optional. Define options (e.g. Size, Color), then generate per-variant SKU, price and stock."
      >
        <VariantsEditor
          initial={{
            variantOptions: initial?.variantOptions ?? [],
            variants: initial?.variants ?? [],
          }}
          onChange={setVariantData}
        />
      </FormSection>

      <FormSection
        title="Specifications"
        description="Shown as the spec table on the product page. Paste a “Key: Value” list to add several at once."
      >
        <SpecsEditor value={specs} onChange={setSpecs} />
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={submit}
        error={error}
        saveLabel={isEdit ? "Save changes" : "Create product"}
      />
    </EditorForm>
  );
}
