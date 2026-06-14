"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";
import type { GalleryStatus } from "@/lib/schemas/gallery";

type L = { en: string; bn: string; ja?: string };
type Img = { url: string; caption: L };

export type AlbumFormInitial = {
  id?: string;
  title?: L;
  slug?: string;
  description?: L;
  coverImage?: string;
  date?: string; // YYYY-MM-DD
  images?: Img[];
  status?: GalleryStatus;
};

const emptyL = (): L => ({ en: "", bn: "", ja: "" });

export function AlbumForm({ initial }: { initial?: AlbumFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(initial?.title ?? emptyL());
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState<L>(
    initial?.description ?? emptyL(),
  );
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [images, setImages] = useState<Img[]>(initial?.images ?? []);
  const [status, setStatus] = useState<GalleryStatus>(
    initial?.status ?? "draft",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function addFiles(files: FileList) {
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setImages((prev) => [
          ...prev,
          { url: json.data.url, caption: emptyL() },
        ]);
      } else {
        setError(json?.error?.code ?? "upload_failed");
      }
    }
    setUploading(false);
  }

  function move(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function setCaption(i: number, caption: L) {
    setImages((prev) =>
      prev.map((im, j) => (j === i ? { ...im, caption } : im)),
    );
  }

  function buildPayload() {
    const clean = (l: L) => ({
      en: l.en.trim(),
      bn: l.bn.trim() || undefined,
      ja: (l.ja ?? "").trim() || undefined,
    });
    const optL = (l: L) =>
      l.en.trim() || l.bn.trim() || (l.ja ?? "").trim() ? clean(l) : undefined;
    return {
      title: clean(title),
      slug: slug.trim() || undefined,
      description: optL(description),
      coverImage: coverImage || undefined,
      date: date || undefined,
      images: images.map((im) => ({
        url: im.url,
        caption: optL(im.caption),
      })),
      status,
    };
  }

  async function submit() {
    if (!title.en.trim()) {
      setError("Please fix — Title (EN): is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit ? `/api/admin/gallery/${initial!.id}` : "/api/admin/gallery",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/gallery");
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <div className="grid max-w-[860px] gap-5">
      <section className="bg-card grid gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Date (optional)</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <BilingualField
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          textarea
        />
        <div className="grid gap-1.5">
          <Label>Cover image (optional — defaults to the first photo)</Label>
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </div>
      </section>

      <section className="bg-card grid gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <Label>Photos ({images.length})</Label>
          <label
            className="border-border bg-card text-primary inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-semibold"
            style={{ cursor: uploading ? "default" : "pointer" }}
          >
            {uploading ? "Uploading…" : "+ Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <p className="text-muted-foreground m-0 text-sm">
            No photos yet — add some above.
          </p>
        ) : (
          <div className="grid gap-3">
            {images.map((im, i) => (
              <div
                key={im.url}
                className="border-border grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-md border p-2"
              >
                <div className="bg-muted relative h-16 w-24 overflow-hidden rounded-md">
                  <Image
                    src={im.url}
                    alt=""
                    fill
                    sizes="96px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Input
                    placeholder="Caption (EN, optional)"
                    value={im.caption.en}
                    onChange={(e) =>
                      setCaption(i, { ...im.caption, en: e.target.value })
                    }
                  />
                  <Input
                    placeholder="ক্যাপশন (বাংলা, optional)"
                    value={im.caption.bn}
                    onChange={(e) =>
                      setCaption(i, { ...im.caption, bn: e.target.value })
                    }
                  />
                  <Input
                    placeholder="キャプション (日本語, optional)"
                    value={im.caption.ja ?? ""}
                    onChange={(e) =>
                      setCaption(i, { ...im.caption, ja: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <MiniBtn
                    label="▲"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  />
                  <MiniBtn
                    label="▼"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                  />
                  <MiniBtn
                    label="✕"
                    danger
                    onClick={() =>
                      setImages((prev) => prev.filter((_, j) => j !== i))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card grid gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as GalleryStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save album" : "Create album"}
        </Button>
      </div>
    </div>
  );
}

function MiniBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        danger
          ? "text-destructive hover:text-destructive h-6 w-[30px]"
          : "text-muted-foreground h-6 w-[30px]"
      }
    >
      {label}
    </Button>
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
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-4">
        {textarea ? (
          <>
            <Textarea
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="日本語"
              value={value.ja ?? ""}
              onChange={(e) => onChange({ ...value, ja: e.target.value })}
              rows={2}
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
              value={value.ja ?? ""}
              onChange={(e) => onChange({ ...value, ja: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}
