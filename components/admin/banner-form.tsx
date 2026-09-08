"use client";

import { useState } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "./image-uploader";
import { formatApiError } from "@/lib/http/form-error";
import { LocalizedInput } from "@/components/admin/ui/localized-input";

export type BannerInitial = {
  id?: string;
  slot?: "hero" | "deal" | "strip";
  title?: { en: string; bn?: string; ja?: string };
  subtitle?: { en: string; bn?: string; ja?: string };
  image?: string;
  images?: string[];
  href?: string;
  cta?: { en: string; bn?: string; ja?: string };
  position?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

/** ISO / Date -> value for <input type="datetime-local"> (local time). */
function toLocalInput(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BannerForm({ initial }: { initial?: BannerInitial }) {
  const afterSave = useAfterSave();
  const isEdit = Boolean(initial?.id);
  const [slot, setSlot] = useState(initial?.slot ?? "hero");
  const [titleEn, setTitleEn] = useState(initial?.title?.en ?? "");
  const [titleBn, setTitleBn] = useState(initial?.title?.bn ?? "");
  const [titleJa, setTitleJa] = useState(initial?.title?.ja ?? "");
  const [subEn, setSubEn] = useState(initial?.subtitle?.en ?? "");
  const [subBn, setSubBn] = useState(initial?.subtitle?.bn ?? "");
  const [subJa, setSubJa] = useState(initial?.subtitle?.ja ?? "");
  const [images, setImages] = useState<string[]>(
    initial?.images?.length
      ? initial.images
      : initial?.image
        ? [initial.image]
        : [],
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt));
  const [href, setHref] = useState(initial?.href ?? "");
  const [ctaEn, setCtaEn] = useState(initial?.cta?.en ?? "");
  const [ctaBn, setCtaBn] = useState(initial?.cta?.bn ?? "");
  const [ctaJa, setCtaJa] = useState(initial?.cta?.ja ?? "");
  const [position, setPosition] = useState(String(initial?.position ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      slot,
      title: {
        en: titleEn,
        bn: titleBn || undefined,
        ja: titleJa || undefined,
      },
      subtitle: subEn
        ? { en: subEn, bn: subBn || undefined, ja: subJa || undefined }
        : undefined,
      image: images[0] || undefined,
      images: images.length ? images : undefined,
      href: href || undefined,
      cta: ctaEn
        ? { en: ctaEn, bn: ctaBn || undefined, ja: ctaJa || undefined }
        : undefined,
      position: Number(position) || 0,
      active,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    };
    const res = await fetch(
      isEdit ? `/api/admin/banners/${initial!.id}` : "/api/admin/banners",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      toast.success(isEdit ? "Banner saved" : "Banner created");
      afterSave("/admin/marketplace/banners");
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="grid max-w-[720px] gap-5">
      <div className="grid gap-1.5">
        <Label>Slot</Label>
        <Select value={slot} onValueChange={(v) => setSlot(v as typeof slot)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hero">Hero (carousel)</SelectItem>
            <SelectItem value="deal">Deal card</SelectItem>
            <SelectItem value="strip">Trust strip</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <LocalizedInput
        label="Title"
        value={{ en: titleEn, bn: titleBn, ja: titleJa }}
        onChange={(v) => {
          setTitleEn(v.en ?? "");
          setTitleBn(v.bn ?? "");
          setTitleJa(v.ja ?? "");
        }}
      />
      <LocalizedInput
        label="Subtitle"
        value={{ en: subEn, bn: subBn, ja: subJa }}
        onChange={(v) => {
          setSubEn(v.en ?? "");
          setSubBn(v.bn ?? "");
          setSubJa(v.ja ?? "");
        }}
      />
      <div className="grid gap-1.5">
        <Label>Images</Label>
        <ImageUploader value={images} onChange={setImages} />
        <p className="text-muted-foreground text-xs">
          Hero slot shows the first image full-width. Deal slot shows all images
          as a product cluster.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Link (href)</Label>
          <Input
            value={href}
            placeholder="/kart/category/medical"
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
        <LocalizedInput
          label="CTA label"
          value={{ en: ctaEn, bn: ctaBn, ja: ctaJa }}
          onChange={(v) => {
            setCtaEn(v.en ?? "");
            setCtaBn(v.bn ?? "");
            setCtaJa(v.ja ?? "");
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Position</Label>
          <Input
            type="number"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Active</Label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Starts at (optional)</Label>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Ends at (optional)</Label>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-3 text-xs">
        Schedule when the banner shows. For a Deal banner, “Ends at” also drives
        the live countdown timer.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create banner"}
        </Button>
      </div>
    </div>
  );
}
