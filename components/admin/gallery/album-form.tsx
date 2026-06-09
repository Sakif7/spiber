"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";
import type { GalleryStatus } from "@/lib/schemas/gallery";

type L = { en: string; bn: string };
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

const emptyL = (): L => ({ en: "", bn: "" });
const field: CSSProperties = { display: "grid", gap: 6 };
const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};
const card: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "grid",
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
    const clean = (l: L) => ({ en: l.en.trim(), bn: l.bn.trim() || undefined });
    const optL = (l: L) => (l.en.trim() || l.bn.trim() ? clean(l) : undefined);
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
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 860 }}>
      <section style={card}>
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <div style={row}>
          <div style={field}>
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </div>
          <div style={field}>
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
        <div style={field}>
          <Label>Cover image (optional — defaults to the first photo)</Label>
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </div>
      </section>

      <section style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Label>Photos ({images.length})</Label>
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
              cursor: uploading ? "default" : "pointer",
            }}
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
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-sm)",
            }}
          >
            No photos yet — add some above.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--s-3)" }}>
            {images.map((im, i) => (
              <div
                key={im.url}
                style={{
                  display: "grid",
                  gridTemplateColumns: "96px 1fr auto",
                  gap: "var(--s-3)",
                  alignItems: "center",
                  padding: "var(--s-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 96,
                    height: 64,
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                    background: "var(--color-surface-2)",
                  }}
                >
                  <Image
                    src={im.url}
                    alt=""
                    fill
                    sizes="96px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
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
                </div>
                <div style={{ display: "grid", gap: 4 }}>
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

      <section style={card}>
        <div style={field}>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GalleryStatus)}
            style={selStyle}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </section>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : isEdit ? "Save album" : "Create album"}
        </CtaButton>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 30,
        height: 24,
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-sm)",
        background: "var(--color-surface)",
        color: danger ? "var(--color-error)" : "var(--color-text-muted)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {label}
    </button>
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
      <div style={row}>
        {textarea ? (
          <>
            <textarea
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              rows={2}
              style={taStyle}
            />
            <textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={2}
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
          </>
        )}
      </div>
    </div>
  );
}
