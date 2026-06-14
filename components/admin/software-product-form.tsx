"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import type {
  SoftwarePricingModel,
  DeliveryType,
  SoftwareStatus,
} from "@/lib/schemas/systems";

type L = { en: string; bn: string; ja: string };

type LInit = { en: string; bn?: string; ja?: string };

export type SoftwareFormInitial = {
  id?: string;
  name?: LInit;
  slug?: string;
  description?: LInit;
  screenshots?: string[];
  features?: LInit[];
  pricingModel?: SoftwarePricingModel;
  priceMinor?: number;
  demoUrl?: string;
  deliveryType?: DeliveryType;
  assetKey?: string;
  externalApp?: string;
  affiliateRateBp?: number;
  status?: SoftwareStatus;
};

const emptyL = (): L => ({ en: "", bn: "", ja: "" });
const toL = (l: LInit): L => ({
  en: l.en ?? "",
  bn: l.bn ?? "",
  ja: l.ja ?? "",
});

const field: CSSProperties = { display: "grid", gap: 6 };
const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};
const triRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "var(--s-4)",
};
const selStyle: CSSProperties = {
  height: 40,
  padding: "0 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  background: "var(--color-surface)",
};
const taStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

export function SoftwareProductForm({
  initial,
}: {
  initial?: SoftwareFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState<L>(
    initial?.name ? toL(initial.name) : emptyL(),
  );
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState<L>(
    initial?.description ? toL(initial.description) : emptyL(),
  );
  const [screenshots, setScreenshots] = useState<string[]>(
    initial?.screenshots ?? [],
  );
  const [features, setFeatures] = useState<L[]>(
    initial?.features ? initial.features.map(toL) : [],
  );
  const [pricingModel, setPricingModel] = useState<SoftwarePricingModel>(
    initial?.pricingModel ?? "one_time",
  );
  const [priceMajor, setPriceMajor] = useState(
    initial?.priceMinor != null ? String(fromMinor(initial.priceMinor)) : "0",
  );
  const [demoUrl, setDemoUrl] = useState(initial?.demoUrl ?? "");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    initial?.deliveryType ?? "license",
  );
  const [assetKey, setAssetKey] = useState(initial?.assetKey ?? "");
  const [assetName, setAssetName] = useState("");
  const [externalApp, setExternalApp] = useState(initial?.externalApp ?? "");
  const [affiliatePct, setAffiliatePct] = useState(
    initial?.affiliateRateBp != null
      ? String(initial.affiliateRateBp / 100)
      : "",
  );
  const [status, setStatus] = useState<SoftwareStatus>(
    initial?.status ?? "draft",
  );
  const [assetBusy, setAssetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function uploadAsset(file: File) {
    setAssetBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/software-assets", {
      method: "POST",
      body: fd,
    });
    const json = await res.json().catch(() => null);
    setAssetBusy(false);
    if (res.ok && json?.ok) {
      setAssetKey(json.data.key);
      setAssetName(json.data.name ?? file.name);
    } else {
      setError(json?.error?.code ?? "asset_upload_failed");
    }
  }

  function buildPayload() {
    const clean = (l: L) => ({
      en: l.en.trim(),
      bn: l.bn.trim() || undefined,
      ja: l.ja.trim() || undefined,
    });
    const optL = (l: L) =>
      l.en.trim() || l.bn.trim() || l.ja.trim() ? clean(l) : undefined;
    const isQuote = pricingModel === "quote";
    const rateBp = affiliatePct
      ? Math.round(Number(affiliatePct) * 100)
      : undefined;
    return {
      name: clean(name),
      slug: slug.trim() || undefined,
      description: optL(description),
      screenshots,
      features: features.map((f) => clean(f)).filter((f) => f.en.length > 0),
      pricingModel,
      priceMinor: isQuote ? undefined : toMinor(Number(priceMajor) || 0),
      demoUrl: demoUrl.trim() || undefined,
      deliveryType,
      assetKey: deliveryType === "asset" ? assetKey || undefined : undefined,
      externalApp:
        deliveryType === "external"
          ? externalApp.trim() || undefined
          : undefined,
      affiliate:
        deliveryType === "external" && rateBp != null ? { rateBp } : undefined,
      status,
    };
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit
        ? `/api/admin/software-products/${initial!.id}`
        : "/api/admin/software-products",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/software-products");
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 760 }}>
      <BilingualField label="Name" value={name} onChange={setName} />
      <div style={row}>
        <div style={field}>
          <Label>Slug (optional)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto from name"
          />
        </div>
        <div style={field}>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SoftwareStatus)}
            style={selStyle}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <BilingualField
        label="Description"
        value={description}
        onChange={setDescription}
        textarea
      />

      {/* Pricing */}
      <div style={row}>
        <div style={field}>
          <Label>Pricing model</Label>
          <select
            value={pricingModel}
            onChange={(e) =>
              setPricingModel(e.target.value as SoftwarePricingModel)
            }
            style={selStyle}
          >
            <option value="one_time">One-time</option>
            <option value="subscription">Subscription</option>
            <option value="quote">Quote (inquiry only)</option>
          </select>
        </div>
        {pricingModel !== "quote" && (
          <div style={field}>
            <Label>Price (BDT)</Label>
            <Input
              type="number"
              value={priceMajor}
              onChange={(e) => setPriceMajor(e.target.value)}
            />
          </div>
        )}
      </div>

      <div style={field}>
        <Label>Demo URL (optional)</Label>
        <Input
          value={demoUrl}
          onChange={(e) => setDemoUrl(e.target.value)}
          placeholder="https://demo.example.com"
        />
      </div>

      {/* Delivery */}
      <div style={field}>
        <Label>Delivery type</Label>
        <select
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
          style={selStyle}
        >
          <option value="license">License key</option>
          <option value="asset">Downloadable asset</option>
          <option value="external">External activation (e.g. ZenHcare)</option>
        </select>
      </div>

      {deliveryType === "asset" && (
        <div style={field}>
          <Label>Asset file (private, gated download)</Label>
          {assetKey ? (
            <div
              style={{
                fontSize: "var(--fs-sm)",
                color: "var(--color-text-muted)",
              }}
            >
              Uploaded: <strong>{assetName || assetKey}</strong>
              <button
                type="button"
                onClick={() => {
                  setAssetKey("");
                  setAssetName("");
                }}
                style={{
                  marginLeft: 10,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-sm)",
                  background: "var(--color-surface)",
                  padding: "2px 10px",
                  cursor: "pointer",
                }}
              >
                Replace
              </button>
            </div>
          ) : (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-brand-deep)",
                fontWeight: 600,
                fontSize: "var(--fs-sm)",
                cursor: assetBusy ? "default" : "pointer",
                justifySelf: "start",
              }}
            >
              {assetBusy ? "Uploading…" : "Upload asset"}
              <input
                type="file"
                hidden
                disabled={assetBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAsset(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}

      {deliveryType === "external" && (
        <div style={row}>
          <div style={field}>
            <Label>External app key</Label>
            <Input
              value={externalApp}
              onChange={(e) => setExternalApp(e.target.value)}
              placeholder="zenhcare"
            />
          </div>
          <div style={field}>
            <Label>Affiliate cut (%)</Label>
            <Input
              type="number"
              value={affiliatePct}
              onChange={(e) => setAffiliatePct(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
        </div>
      )}

      {/* Screenshots */}
      <div style={field}>
        <Label>Screenshots</Label>
        <ImageUploader value={screenshots} onChange={setScreenshots} />
      </div>

      {/* Features */}
      <div style={field}>
        <Label>Features</Label>
        {features.map((f, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <Input
              placeholder="EN"
              value={f.en}
              onChange={(e) =>
                setFeatures((fs) =>
                  fs.map((x, j) =>
                    j === i ? { ...x, en: e.target.value } : x,
                  ),
                )
              }
            />
            <Input
              placeholder="বাংলা"
              value={f.bn}
              onChange={(e) =>
                setFeatures((fs) =>
                  fs.map((x, j) =>
                    j === i ? { ...x, bn: e.target.value } : x,
                  ),
                )
              }
            />
            <Input
              placeholder="日本語"
              value={f.ja}
              onChange={(e) =>
                setFeatures((fs) =>
                  fs.map((x, j) =>
                    j === i ? { ...x, ja: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() => setFeatures((fs) => fs.filter((_, j) => j !== i))}
              aria-label="Remove feature"
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-sm)",
                background: "var(--color-surface)",
                color: "var(--color-error)",
                padding: "6px 8px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFeatures((fs) => [...fs, emptyL()])}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-brand-deep)",
            fontWeight: 600,
            fontSize: "var(--fs-sm)",
            cursor: "pointer",
            justifySelf: "start",
          }}
        >
          <Plus size={13} /> Feature
        </button>
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : isEdit ? "Save product" : "Create product"}
        </CtaButton>
      </div>
    </div>
  );
}

function BilingualField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: L;
  onChange: (v: L) => void;
  textarea?: boolean;
}) {
  return (
    <div style={field}>
      <Label>{label}</Label>
      <div style={triRow}>
        {textarea ? (
          <>
            <textarea
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              rows={3}
              style={taStyle}
            />
            <textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={3}
              style={taStyle}
            />
            <textarea
              placeholder="日本語"
              value={value.ja}
              onChange={(e) => onChange({ ...value, ja: e.target.value })}
              rows={3}
              style={taStyle}
            />
          </>
        ) : (
          <>
            <Input
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
            />
            <Input
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
            />
            <Input
              placeholder="日本語"
              value={value.ja}
              onChange={(e) => onChange({ ...value, ja: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function SoftwareDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete "${name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/software-products/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else window.alert("delete_failed");
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      style={{
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-sm)",
        color: "var(--color-error)",
        padding: "4px 10px",
        fontSize: "var(--fs-small)",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
