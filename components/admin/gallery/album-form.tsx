"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EditorForm,
  FormField,
  FormGrid,
  FormSection,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import {
  LocalizedInput,
  type LocalizedValue,
} from "@/components/admin/ui/localized-input";
import { SelectField } from "@/components/admin/ui/select-field";
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

/** Fold a LocalizedInput patch back into the { en, bn, ja? } shape used here. */
const mergeL = (cur: L, v: LocalizedValue): L => ({
  ...cur,
  ...v,
  en: v.en ?? "",
  bn: v.bn ?? "",
});

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

export function AlbumForm({ initial }: { initial?: AlbumFormInitial }) {
  const afterSave = useAfterSave();
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
      afterSave("/admin/gallery");
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <EditorForm>
      <FormSection title="Album">
        <LocalizedInput
          label="Title"
          required
          value={title}
          onChange={(v) => setTitle(mergeL(title, v))}
        />
        <FormGrid>
          <FormField label="Slug (optional)" htmlFor="album-slug">
            <Input
              id="album-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </FormField>
          <FormField label="Date (optional)" htmlFor="album-date">
            <Input
              id="album-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <LocalizedInput
          label="Description (optional)"
          textarea
          rows={2}
          value={description}
          onChange={(v) => setDescription(mergeL(description, v))}
        />
        <FormField
          label="Cover image (optional)"
          hint="Defaults to the first photo."
        >
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </FormField>
      </FormSection>

      <FormSection
        title="Photos"
        description={`${images.length} photo${images.length === 1 ? "" : "s"} in this album.`}
        action={
          <Button asChild variant="outline" size="sm" className="w-fit">
            <label className={uploading ? "" : "cursor-pointer"}>
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Add photos"}
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
          </Button>
        }
      >
        {images.length === 0 ? (
          <p className="text-muted-foreground">
            No photos yet — add some above.
          </p>
        ) : (
          <div className="divide-border/60 divide-y">
            {images.map((im, i) => (
              <div
                key={im.url}
                className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
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
                <LocalizedInput
                  value={im.caption}
                  placeholder="Caption (optional)"
                  onChange={(v) => setCaption(i, mergeL(im.caption, v))}
                />
                <div className="grid gap-1">
                  <MiniBtn
                    label={`Move photo ${i + 1} up`}
                    icon={ChevronUp}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  />
                  <MiniBtn
                    label={`Move photo ${i + 1} down`}
                    icon={ChevronDown}
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                  />
                  <MiniBtn
                    label={`Remove photo ${i + 1}`}
                    icon={X}
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
      </FormSection>

      <FormSection title="Publishing">
        <FormField label="Status" htmlFor="album-status">
          <SelectField
            id="album-status"
            value={status}
            onChange={(v) => setStatus(v as GalleryStatus)}
            options={STATUS_OPTIONS}
            className="sm:max-w-xs"
          />
        </FormField>
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={submit}
        error={error}
        saveLabel={isEdit ? "Save album" : "Create album"}
      />
    </EditorForm>
  );
}

function MiniBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        danger
          ? "text-destructive hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      }
    >
      <Icon aria-hidden />
    </Button>
  );
}
