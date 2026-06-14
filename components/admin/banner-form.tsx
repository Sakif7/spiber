"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
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

export type BannerInitial = {
  id?: string;
  slot?: "hero" | "deal" | "strip";
  title?: { en: string; bn?: string; ja?: string };
  subtitle?: { en: string; bn?: string; ja?: string };
  image?: string;
  href?: string;
  cta?: { en: string; bn?: string; ja?: string };
  position?: number;
  active?: boolean;
};

export function BannerForm({ initial }: { initial?: BannerInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [slot, setSlot] = useState(initial?.slot ?? "hero");
  const [titleEn, setTitleEn] = useState(initial?.title?.en ?? "");
  const [titleBn, setTitleBn] = useState(initial?.title?.bn ?? "");
  const [titleJa, setTitleJa] = useState(initial?.title?.ja ?? "");
  const [subEn, setSubEn] = useState(initial?.subtitle?.en ?? "");
  const [subBn, setSubBn] = useState(initial?.subtitle?.bn ?? "");
  const [subJa, setSubJa] = useState(initial?.subtitle?.ja ?? "");
  const [images, setImages] = useState<string[]>(
    initial?.image ? [initial.image] : [],
  );
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
      href: href || undefined,
      cta: ctaEn
        ? { en: ctaEn, bn: ctaBn || undefined, ja: ctaJa || undefined }
        : undefined,
      position: Number(position) || 0,
      active,
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
      router.push("/admin/marketplace/banners");
      router.refresh();
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
      <div className="grid gap-1.5">
        <Label>Title</Label>
        <div className="grid grid-cols-3 gap-4">
          <Input
            placeholder="EN"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
          <Input
            placeholder="বাংলা"
            value={titleBn}
            onChange={(e) => setTitleBn(e.target.value)}
          />
          <Input
            placeholder="日本語"
            value={titleJa}
            onChange={(e) => setTitleJa(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Subtitle</Label>
        <div className="grid grid-cols-3 gap-4">
          <Input
            placeholder="EN"
            value={subEn}
            onChange={(e) => setSubEn(e.target.value)}
          />
          <Input
            placeholder="বাংলা"
            value={subBn}
            onChange={(e) => setSubBn(e.target.value)}
          />
          <Input
            placeholder="日本語"
            value={subJa}
            onChange={(e) => setSubJa(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Image</Label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Link (href)</Label>
          <Input
            value={href}
            placeholder="/marketplace/category/medical"
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>CTA label</Label>
          <div className="grid grid-cols-3 gap-4">
            <Input
              placeholder="EN"
              value={ctaEn}
              onChange={(e) => setCtaEn(e.target.value)}
            />
            <Input
              placeholder="বাংলা"
              value={ctaBn}
              onChange={(e) => setCtaBn(e.target.value)}
            />
            <Input
              placeholder="日本語"
              value={ctaJa}
              onChange={(e) => setCtaJa(e.target.value)}
            />
          </div>
        </div>
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
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create banner"}
        </Button>
      </div>
    </div>
  );
}
