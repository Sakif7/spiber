"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { SpecsEditor, type SpecRow } from "@/components/admin/specs-editor";

type Localized = { en: string; bn?: string; ja?: string };

type Initial = {
  id: string;
  name: Localized;
  description?: Localized;
  categoryId: string;
  priceMajor: number | string;
  stockQty: number;
  lowStockThreshold: number;
  images: string[];
  specs: SpecRow[];
  status: "draft" | "active";
};

export function SellerProductForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: Initial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [nameBn, setNameBn] = useState(initial?.name.bn ?? "");
  const [nameJa, setNameJa] = useState(initial?.name.ja ?? "");
  const [descEn, setDescEn] = useState(initial?.description?.en ?? "");
  const [descBn, setDescBn] = useState(initial?.description?.bn ?? "");
  const [descJa, setDescJa] = useState(initial?.description?.ja ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [price, setPrice] = useState(
    initial?.priceMajor === undefined || initial?.priceMajor === ""
      ? ""
      : String(initial?.priceMajor),
  );
  const [stockQty, setStockQty] = useState(String(initial?.stockQty ?? 0));
  const [lowStock, setLowStock] = useState(
    String(initial?.lowStockThreshold ?? 5),
  );
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [specs, setSpecs] = useState<SpecRow[]>(initial?.specs ?? []);
  const [status, setStatus] = useState<"draft" | "active">(
    initial?.status ?? "draft",
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!nameEn.trim()) {
      setError("Product name (English) is required.");
      return;
    }
    if (!categoryId) {
      setError("Please choose a category.");
      return;
    }
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price in BDT (greater than zero).");
      return;
    }

    const hasDesc = descEn.trim() || descBn.trim() || descJa.trim();
    const cleanSpecs = specs.filter((s) => s.key.en && s.value.en);

    const body = {
      name: {
        en: nameEn.trim(),
        bn: nameBn.trim() || undefined,
        ja: nameJa.trim() || undefined,
      },
      description: hasDesc
        ? {
            en: descEn.trim(),
            bn: descBn.trim() || undefined,
            ja: descJa.trim() || undefined,
          }
        : undefined,
      categoryId,
      priceMinor: Math.round(priceNum * 100),
      stockQty: Number(stockQty) || 0,
      lowStockThreshold: Number(lowStock) || 0,
      images,
      specs: cleanSpecs,
      status,
    };

    setBusy(true);
    try {
      const res = await fetch(
        isEdit ? `/api/seller/products/${initial!.id}` : "/api/seller/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        router.push("/seller/products");
        router.refresh();
      } else {
        setError(
          json?.error?.message ??
            json?.error?.code ??
            "Could not save this product. Please check your entries.",
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--s-5)" }}>
      <p style={note}>
        New and edited products are reviewed by our team before going live.
      </p>

      <Section title="Name">
        <Field label="Name (English)" required>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
            maxLength={200}
          />
        </Field>
        <div style={twoCol}>
          <Field label="Name (বাংলা)">
            <Input
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Name (日本語)">
            <Input
              value={nameJa}
              onChange={(e) => setNameJa(e.target.value)}
              maxLength={200}
            />
          </Field>
        </div>
      </Section>

      <Section title="Description">
        <Field label="Description (English)">
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={4}
            style={textarea}
          />
        </Field>
        <div style={twoCol}>
          <Field label="Description (বাংলা)">
            <textarea
              value={descBn}
              onChange={(e) => setDescBn(e.target.value)}
              rows={4}
              style={textarea}
            />
          </Field>
          <Field label="Description (日本語)">
            <textarea
              value={descJa}
              onChange={(e) => setDescJa(e.target.value)}
              rows={4}
              style={textarea}
            />
          </Field>
        </div>
      </Section>

      <Section title="Pricing & inventory">
        <Field label="Category" required>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            style={select}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div style={threeCol}>
          <Field label="Price (BDT)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Field>
          <Field label="Stock">
            <Input
              type="number"
              min="0"
              step="1"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
          </Field>
          <Field label="Low-stock threshold">
            <Input
              type="number"
              min="0"
              step="1"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Images">
        <ImageUploader value={images} onChange={setImages} />
      </Section>

      <Section title="Specifications">
        <SpecsEditor value={specs} onChange={setSpecs} />
      </Section>

      <Section title="Status">
        <div style={{ display: "flex", gap: "var(--s-5)", flexWrap: "wrap" }}>
          <label style={radioRow}>
            <input
              type="radio"
              name="status"
              checked={status === "draft"}
              onChange={() => setStatus("draft")}
            />
            <span>Draft</span>
          </label>
          <label style={radioRow}>
            <input
              type="radio"
              name="status"
              checked={status === "active"}
              onChange={() => setStatus("active")}
            />
            <span>Active</span>
          </label>
        </div>
      </Section>

      {error && (
        <span style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </span>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <CtaButton type="submit" style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </CtaButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        padding: "var(--s-5)",
        display: "grid",
        gap: "var(--s-4)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h5)",
          color: "var(--color-text-strong)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>
        {label}
        {required && <span style={{ color: "var(--color-error)" }}> *</span>}
      </Label>
      {children}
    </div>
  );
}

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};

const threeCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "var(--s-4)",
};

const textarea: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
  color: "var(--color-text)",
};

const select: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  color: "var(--color-text)",
};

const radioRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  color: "var(--color-text)",
};

const note: CSSProperties = {
  fontSize: "var(--fs-small)",
  color: "var(--color-text-muted)",
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  padding: "10px 14px",
};
