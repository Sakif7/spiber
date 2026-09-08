"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Trash2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/admin/image-uploader";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import type {
  SoftwarePricingModel,
  DeliveryType,
  SoftwareStatus,
} from "@/lib/schemas/systems";
import { LocalizedInput, type LocalizedValue } from "./ui/localized-input";
import { SelectField } from "./ui/select-field";
import {
  EditorForm,
  FormField,
  FormGrid,
  FormSection,
  SaveBar,
} from "./ui/form-shell";

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
/** LocalizedInput hands back a partial value; the payload builder wants all three. */
const fromLV = (v: LocalizedValue): L => ({
  en: v.en ?? "",
  bn: v.bn ?? "",
  ja: v.ja ?? "",
});

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];
const PRICING_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "subscription", label: "Subscription" },
  { value: "quote", label: "Quote (inquiry only)" },
];
const DELIVERY_OPTIONS = [
  { value: "license", label: "License key" },
  { value: "asset", label: "Downloadable asset" },
  { value: "external", label: "External activation (e.g. ZenHcare)" },
];

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
    <EditorForm>
      <FormSection
        title="Basics"
        description="How the product is presented in the Digihealth catalog."
      >
        <LocalizedInput
          label="Name"
          required
          value={name}
          onChange={(v) => setName(fromLV(v))}
          placeholder="e.g. Clinic Management Suite"
        />
        <FormGrid>
          <FormField
            label="Slug (optional)"
            htmlFor="software-slug"
            hint="Leave blank to derive it from the English name."
          >
            <Input
              id="software-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from name"
            />
          </FormField>
          <FormField label="Status">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as SoftwareStatus)}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
            />
          </FormField>
        </FormGrid>
        <LocalizedInput
          label="Description"
          textarea
          value={description}
          onChange={(v) => setDescription(fromLV(v))}
        />
        <FormField
          label="Demo URL (optional)"
          htmlFor="software-demo"
          hint="Shown as a “Try the demo” link on the product page."
        >
          <Input
            id="software-demo"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://demo.example.com"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Pricing"
        description="Quote-only products are not purchasable — they collect an inquiry instead."
      >
        <FormGrid>
          <FormField label="Pricing model">
            <SelectField
              value={pricingModel}
              onChange={(v) => setPricingModel(v as SoftwarePricingModel)}
              ariaLabel="Pricing model"
              options={PRICING_OPTIONS}
            />
          </FormField>
          {pricingModel !== "quote" && (
            <FormField label="Price (BDT)" htmlFor="software-price">
              <Input
                id="software-price"
                type="number"
                value={priceMajor}
                onChange={(e) => setPriceMajor(e.target.value)}
              />
            </FormField>
          )}
        </FormGrid>
      </FormSection>

      <FormSection
        title="Delivery"
        description="What the buyer receives once the purchase is marked paid."
      >
        <FormField label="Delivery type">
          <SelectField
            value={deliveryType}
            onChange={(v) => setDeliveryType(v as DeliveryType)}
            ariaLabel="Delivery type"
            options={DELIVERY_OPTIONS}
            className="sm:max-w-md"
          />
        </FormField>

        {deliveryType === "asset" && (
          <FormField
            label="Asset file"
            hint="Stored privately and served through the gated download route — never a public URL."
          >
            {assetKey ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">
                  Uploaded:{" "}
                  <strong className="text-foreground">
                    {assetName || assetKey}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAssetKey("");
                    setAssetName("");
                  }}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-fit">
                <label className={assetBusy ? "" : "cursor-pointer"}>
                  <Upload className="size-4" />
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
              </Button>
            )}
          </FormField>
        )}

        {deliveryType === "external" && (
          <FormGrid>
            <FormField
              label="External app key"
              htmlFor="software-external"
              hint="Identifies the external system in the provisioning task."
            >
              <Input
                id="software-external"
                value={externalApp}
                onChange={(e) => setExternalApp(e.target.value)}
                placeholder="zenhcare"
              />
            </FormField>
            <FormField
              label="Affiliate cut (%)"
              htmlFor="software-affiliate"
              hint="Accrued on the amount actually charged, snapshotted per sale."
            >
              <Input
                id="software-affiliate"
                type="number"
                value={affiliatePct}
                onChange={(e) => setAffiliatePct(e.target.value)}
                placeholder="e.g. 15"
              />
            </FormField>
          </FormGrid>
        )}
      </FormSection>

      <FormSection
        title="Screenshots"
        description="The first screenshot is used as the catalog thumbnail."
      >
        <ImageUploader value={screenshots} onChange={setScreenshots} />
      </FormSection>

      <FormSection
        title="Features"
        description="Bullet points listed on the product page. English is required for a bullet to be saved."
      >
        {features.length > 0 && (
          <div className="divide-border/60 bg-card divide-y rounded-lg border">
            {features.map((f, i) => (
              <div key={i} className="flex items-end gap-3 px-3 py-3">
                <LocalizedInput
                  className="min-w-0 flex-1"
                  label={i === 0 ? "Feature" : undefined}
                  ariaLabel={`Feature ${i + 1}`}
                  value={f}
                  placeholder="e.g. Appointment scheduling"
                  onChange={(v) =>
                    setFeatures((fs) =>
                      fs.map((x, j) => (j === i ? fromLV(v) : x)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove feature ${i + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setFeatures((fs) => fs.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setFeatures((fs) => [...fs, emptyL()])}
        >
          <Plus className="size-4" />
          Add feature
        </Button>
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={submit}
        error={error}
        saveLabel={isEdit ? "Save product" : "Create product"}
      />
    </EditorForm>
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
    if (!window.confirm(`Delete"${name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/software-products/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else window.alert("delete_failed");
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={busy}
      className="text-destructive hover:text-destructive h-7 px-2"
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
