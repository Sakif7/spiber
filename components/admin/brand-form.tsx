"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";

export type BrandFormValue = {
  id: string;
  nameEn: string;
  nameBn?: string;
  nameJa?: string;
  slug: string;
  logo?: string;
};

/**
 * Create OR edit a brand. Pass `brand` to edit an existing one (PATCHes
 * `/api/admin/brands/[id]`); omit it to create (POST). Both flows accept a
 * logo/icon image, uploaded via the shared `SingleImageField`. The logo drives
 * the "Shop by brand" grid and the storefront brand strip.
 */
export function BrandForm({
  brand,
  onDone,
}: {
  brand?: BrandFormValue;
  onDone?: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(brand);

  const [nameEn, setNameEn] = useState(brand?.nameEn ?? "");
  const [nameBn, setNameBn] = useState(brand?.nameBn ?? "");
  const [nameJa, setNameJa] = useState(brand?.nameJa ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [logo, setLogo] = useState(brand?.logo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nameEn.trim()) {
      setError("Name (EN) is required");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: {
        en: nameEn.trim(),
        bn: nameBn.trim() || undefined,
        ja: nameJa.trim() || undefined,
      },
      slug: slug.trim() || undefined,
      logo: logo.trim() || undefined,
    };
    const res = await fetch(
      editing ? `/api/admin/brands/${brand!.id}` : "/api/admin/brands",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      if (!editing) {
        setNameEn("");
        setNameBn("");
        setNameJa("");
        setSlug("");
        setLogo("");
      }
      toast.success(editing ? "Brand updated" : "Brand added");
      router.refresh();
      onDone?.();
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="grid max-w-[560px] gap-4">
      <div className="grid gap-1.5">
        <Label>Name</Label>
        <div className="grid grid-cols-3 gap-4">
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
      <div className="grid gap-1.5">
        <Label>Slug</Label>
        <Input
          value={slug}
          placeholder="auto from name"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Logo / icon</Label>
        <SingleImageField value={logo} onChange={setLogo} label="Upload logo" />
        <p className="text-muted-foreground text-xs">
          A transparent PNG or SVG works best — it shows in the “Shop by brand”
          grid and the brand strip on the Spiber Kart homepage.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add brand"}
        </Button>
        {editing && onDone && (
          <Button variant="ghost" type="button" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export function BrandDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    const ok = window.confirm(`Delete brand "${name}"?`);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/brands/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      router.refresh();
    } else {
      window.alert(formatApiError(json, "delete_failed"));
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={remove}
      disabled={busy}
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
