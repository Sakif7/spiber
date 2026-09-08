"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import { ImageUploader } from "./image-uploader";
import { SpecsEditor, type SpecRow } from "./specs-editor";
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

export type ProductFormInitial = {
  id?: string;
  sku?: string;
  slug?: string;
  name?: { en: string; bn?: string; ja?: string };
  description?: { en: string; bn?: string; ja?: string };
  categoryId?: string;
  brandId?: string;
  priceMinor?: number;
  floorPriceMinor?: number | null;
  lowStockThreshold?: number;
  /** Read-only here — stock is changed in Inventory. */
  stockQty?: number;
  trackStock?: boolean | null;
  status?: "draft" | "active" | "archived";
  specs?: SpecRow[];
  images?: string[];
};

type Option = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const TRACKING_OPTIONS = [
  { value: "default", label: "Default — tracked once priced" },
  { value: "on", label: "Track stock" },
  { value: "off", label: "Don’t track (quotation-only)" },
];

export function ProductForm({
  initial,
  categories,
  brands,
}: {
  initial?: ProductFormInitial;
  categories: CategoryOption[];
  brands: Option[];
}) {
  const router = useRouter();
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
  const [floorPrice, setFloorPrice] = useState(
    initial?.floorPriceMinor != null
      ? String(fromMinor(initial.floorPriceMinor))
      : "",
  );
  const [lowStock, setLowStock] = useState(
    String(initial?.lowStockThreshold ?? 5),
  );
  const [trackStock, setTrackStock] = useState<"default" | "on" | "off">(
    initial?.trackStock === true
      ? "on"
      : initial?.trackStock === false
        ? "off"
        : "default",
  );
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [specs, setSpecs] = useState<SpecRow[]>(initial?.specs ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      // Instruments products are quote-only (catalog + RFQ; no cart/checkout).
      storefront: "instruments" as const,
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
      // Optional — blank means"Price on request".
      priceMinor: price.trim() ? toMinor(Number(price) || 0) : null,
      // Optional negotiation floor. Blank clears it (null), so Medtrade falls
      // back to a single price instead of a range.
      floorPriceMinor: floorPrice.trim()
        ? toMinor(Number(floorPrice) || 0)
        : null,
      lowStockThreshold: Number(lowStock) || 0,
      // null = default rule (tracked once priced); true/false force it.
      trackStock:
        trackStock === "on" ? true : trackStock === "off" ? false : null,
      status,
      specs: specs.filter((s) => s.key.en && s.value.en),
      images,
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
      router.push("/admin/products");
      router.refresh();
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
          placeholder="e.g. 12-Channel ECG Machine"
        />
        <FormGrid>
          <FormField label="SKU" htmlFor="product-sku" required>
            <Input
              id="product-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor="product-slug"
            hint="Leave blank to derive it from the English name."
          >
            <Input
              id="product-slug"
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
        <FormField label="Status">
          <SelectField
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            ariaLabel="Status"
            options={STATUS_OPTIONS}
            className="sm:max-w-xs"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Pricing & stock"
        description="Medtrade products are quotation-only until they carry a price."
      >
        <FormGrid>
          <FormField
            label="Price (BDT, optional)"
            htmlFor="product-price"
            hint="Set a price to make this product buyable on Medtrade. Leave blank to keep it quotation-only."
          >
            <Input
              id="product-price"
              type="number"
              value={price}
              placeholder="Leave blank for “Price on request”"
              onChange={(e) => setPrice(e.target.value)}
            />
          </FormField>
          <FormField
            label="Floor price (BDT, optional)"
            htmlFor="product-floor"
            hint="Medtrade shows ৳floor – ৳price as a negotiable range. Checkout always bills the list price; the floor guides quotations."
          >
            <Input
              id="product-floor"
              type="number"
              value={floorPrice}
              placeholder="Lowest negotiable price"
              onChange={(e) => setFloorPrice(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Low-stock threshold" htmlFor="product-low-stock">
            <Input
              id="product-low-stock"
              type="number"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          </FormField>
          <FormField
            label="Stock tracking"
            hint="Tracked products count towards low-stock alerts and the inventory KPIs."
          >
            <SelectField
              value={trackStock}
              onChange={(v) => setTrackStock(v as "default" | "on" | "off")}
              ariaLabel="Stock tracking"
              options={TRACKING_OPTIONS}
            />
          </FormField>
        </FormGrid>
        {isEdit && (
          <ProductStockCard
            productId={initial!.id!}
            sku={sku}
            stockQty={initial?.stockQty ?? 0}
            tracked={
              trackStock === "on" ||
              (trackStock === "default" && price.trim() !== "")
            }
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
