"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import { ImageUploader } from "./image-uploader";
import { SpecsEditor, type SpecRow } from "./specs-editor";
import { VariantsEditor, type VariantsValue } from "./variants-editor";
import { CategorySelect, type CategoryOption } from "./category-select";

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
  lowStockThreshold?: number;
  status?: "draft" | "active" | "archived";
  featured?: boolean;
  specs?: SpecRow[];
  images?: string[];
  variantOptions?: VariantsValue["variantOptions"];
  variants?: VariantsValue["variants"];
};

type Option = { id: string; name: string };

export function MarketplaceProductForm({
  initial,
  categories,
  brands,
}: {
  initial?: MarketplaceProductInitial;
  categories: CategoryOption[];
  brands: Option[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [nameEn, setNameEn] = useState(initial?.name?.en ?? "");
  const [nameBn, setNameBn] = useState(initial?.name?.bn ?? "");
  const [nameJa, setNameJa] = useState(initial?.name?.ja ?? "");
  const [descEn, setDescEn] = useState(initial?.description?.en ?? "");
  const [descBn, setDescBn] = useState(initial?.description?.bn ?? "");
  const [descJa, setDescJa] = useState(initial?.description?.ja ?? "");
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
      name: { en: nameEn, bn: nameBn || undefined, ja: nameJa || undefined },
      description: descEn
        ? { en: descEn, bn: descBn || undefined, ja: descJa || undefined }
        : undefined,
      categoryId,
      brandId: brandId || undefined,
      priceMinor: price.trim() ? toMinor(Number(price) || 0) : null,
      compareAtMinor: compareAt.trim() ? toMinor(Number(compareAt) || 0) : null,
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
      router.push("/admin/marketplace/products");
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  const field = { display: "grid", gap: 6 } as const;
  const row = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--s-4)",
  } as const;
  const triRow = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "var(--s-4)",
  } as const;
  const sel: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    background: "var(--color-surface)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 820 }}>
      <div style={field}>
        <Label>Name</Label>
        <div style={triRow}>
          <Input
            placeholder="EN"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <Input
            placeholder="বাংলা"
            value={nameBn}
            onChange={(e) => setNameBn(e.target.value)}
          />
          <Input
            placeholder="日本語"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
          />
        </div>
      </div>
      <div style={row}>
        <div style={field}>
          <Label>SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div style={field}>
          <Label>Slug</Label>
          <Input
            value={slug}
            placeholder="auto from name"
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </div>
      <div style={field}>
        <Label>Description</Label>
        <div style={triRow}>
          <textarea
            rows={3}
            placeholder="EN"
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            style={{ ...sel, height: "auto", padding: 10 }}
          />
          <textarea
            rows={3}
            placeholder="বাংলা"
            value={descBn}
            onChange={(e) => setDescBn(e.target.value)}
            style={{ ...sel, height: "auto", padding: 10 }}
          />
          <textarea
            rows={3}
            placeholder="日本語"
            value={descJa}
            onChange={(e) => setDescJa(e.target.value)}
            style={{ ...sel, height: "auto", padding: 10 }}
          />
        </div>
      </div>
      <div style={row}>
        <div style={field}>
          <Label>Category</Label>
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <div style={field}>
          <Label>Brand</Label>
          <select
            style={sel}
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">— none —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={triRow}>
        <div style={field}>
          <Label>Base price (BDT)</Label>
          <Input
            type="number"
            value={price}
            placeholder="Required (or set per variant)"
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div style={field}>
          <Label>Compare-at / “was” price (BDT)</Label>
          <Input
            type="number"
            value={compareAt}
            placeholder="Optional — shows a Sale badge"
            onChange={(e) => setCompareAt(e.target.value)}
          />
        </div>
        <div style={field}>
          <Label>Low-stock threshold</Label>
          <Input
            type="number"
            value={lowStock}
            onChange={(e) => setLowStock(e.target.value)}
          />
        </div>
      </div>
      <div style={row}>
        <div style={field}>
          <Label>Status</Label>
          <select
            style={sel}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 26,
          }}
        >
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          Featured on homepage
        </label>
      </div>
      <div style={field}>
        <Label>Images</Label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <div style={field}>
        <Label>Variants</Label>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-muted)",
          }}
        >
          Optional. Define options (e.g. Size, Color), then generate per-variant
          SKU / price / stock.
        </p>
        <VariantsEditor
          initial={{
            variantOptions: initial?.variantOptions ?? [],
            variants: initial?.variants ?? [],
          }}
          onChange={setVariantData}
        />
      </div>
      <div style={field}>
        <Label>Specifications</Label>
        <SpecsEditor value={specs} onChange={setSpecs} />
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <CtaButton onClick={submit}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
      </CtaButton>
    </div>
  );
}
