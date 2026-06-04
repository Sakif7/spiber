"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { ImageUploader } from "./image-uploader";
import { formatApiError } from "@/lib/http/form-error";

export type BannerInitial = {
  id?: string;
  slot?: "hero" | "deal" | "strip";
  title?: { en: string; bn?: string };
  subtitle?: { en: string; bn?: string };
  image?: string;
  href?: string;
  cta?: { en: string; bn?: string };
  position?: number;
  active?: boolean;
};

export function BannerForm({ initial }: { initial?: BannerInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [slot, setSlot] = useState(initial?.slot ?? "hero");
  const [titleEn, setTitleEn] = useState(initial?.title?.en ?? "");
  const [titleBn, setTitleBn] = useState(initial?.title?.bn ?? "");
  const [subEn, setSubEn] = useState(initial?.subtitle?.en ?? "");
  const [subBn, setSubBn] = useState(initial?.subtitle?.bn ?? "");
  const [images, setImages] = useState<string[]>(
    initial?.image ? [initial.image] : [],
  );
  const [href, setHref] = useState(initial?.href ?? "");
  const [ctaEn, setCtaEn] = useState(initial?.cta?.en ?? "");
  const [ctaBn, setCtaBn] = useState(initial?.cta?.bn ?? "");
  const [position, setPosition] = useState(String(initial?.position ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const payload = {
      slot,
      title: { en: titleEn, bn: titleBn || undefined },
      subtitle: subEn ? { en: subEn, bn: subBn || undefined } : undefined,
      image: images[0] || undefined,
      href: href || undefined,
      cta: ctaEn ? { en: ctaEn, bn: ctaBn || undefined } : undefined,
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
      router.push("/admin/marketplace/banners");
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
  const sel: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    background: "var(--color-surface)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 720 }}>
      <div style={field}>
        <Label>Slot</Label>
        <select
          style={sel}
          value={slot}
          onChange={(e) => setSlot(e.target.value as typeof slot)}
        >
          <option value="hero">Hero (carousel)</option>
          <option value="deal">Deal card</option>
          <option value="strip">Trust strip</option>
        </select>
      </div>
      <div style={field}>
        <Label>Title</Label>
        <div style={row}>
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
        </div>
      </div>
      <div style={field}>
        <Label>Subtitle</Label>
        <div style={row}>
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
        </div>
      </div>
      <div style={field}>
        <Label>Image</Label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <div style={row}>
        <div style={field}>
          <Label>Link (href)</Label>
          <Input
            value={href}
            placeholder="/marketplace/category/medical"
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
        <div style={field}>
          <Label>CTA label</Label>
          <div style={row}>
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
          </div>
        </div>
      </div>
      <div style={row}>
        <div style={field}>
          <Label>Position</Label>
          <Input
            type="number"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
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
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
      </div>
      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <CtaButton onClick={submit}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Create banner"}
      </CtaButton>
    </div>
  );
}
