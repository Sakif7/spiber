"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { RichTextEditor } from "./rich-text-editor";
import { formatApiError } from "@/lib/http/form-error";
import type { BlogStatus } from "@/lib/schemas/blog";

type L = { en: string; bn: string; ja: string };
type Opt = { id: string; name: string };

type LInit = { en?: string; bn?: string; ja?: string };

export type PostEditorInitial = {
  id?: string;
  title?: LInit;
  slug?: string;
  excerpt?: LInit;
  bodyEn?: string;
  bodyBn?: string;
  bodyJa?: string;
  coverImage?: string;
  authorName?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: BlogStatus;
  scheduledFor?: string; // datetime-local value
  seo?: {
    metaTitle?: LInit;
    metaDescription?: LInit;
    ogImage?: string;
  };
};

const fillL = (l?: LInit): L => ({
  en: l?.en ?? "",
  bn: l?.bn ?? "",
  ja: l?.ja ?? "",
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
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  background: "var(--color-surface)",
};
const taStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

export function PostEditor({
  initial,
  categories,
  tags,
}: {
  initial?: PostEditorInitial;
  categories: Opt[];
  tags: Opt[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(fillL(initial?.title));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState<L>(fillL(initial?.excerpt));
  const [bodyEn, setBodyEn] = useState(initial?.bodyEn ?? "");
  const [bodyBn, setBodyBn] = useState(initial?.bodyBn ?? "");
  const [bodyJa, setBodyJa] = useState(initial?.bodyJa ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [status, setStatus] = useState<BlogStatus>(initial?.status ?? "draft");
  const [scheduledFor, setScheduledFor] = useState(initial?.scheduledFor ?? "");
  const [metaTitle, setMetaTitle] = useState<L>(fillL(initial?.seo?.metaTitle));
  const [metaDescription, setMetaDescription] = useState<L>(
    fillL(initial?.seo?.metaDescription),
  );
  const [ogImage, setOgImage] = useState(initial?.seo?.ogImage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function buildPayload() {
    const clean = (l: L) => ({
      en: l.en.trim(),
      bn: l.bn.trim() || undefined,
      ja: l.ja.trim() || undefined,
    });
    const optL = (l: L) =>
      l.en.trim() || l.bn.trim() || l.ja.trim() ? clean(l) : undefined;
    const seoMt = optL(metaTitle);
    const seoMd = optL(metaDescription);
    const seo =
      seoMt || seoMd || ogImage
        ? {
            metaTitle: seoMt,
            metaDescription: seoMd,
            ogImage: ogImage || undefined,
          }
        : undefined;
    return {
      title: clean(title),
      slug: slug.trim() || undefined,
      excerpt: optL(excerpt),
      body: {
        en: bodyEn || "<p></p>",
        bn: bodyBn.trim() ? bodyBn : undefined,
        ja: bodyJa.trim() ? bodyJa : undefined,
      },
      coverImage: coverImage || undefined,
      authorName: authorName.trim() || undefined,
      categoryId: categoryId || undefined,
      tagIds,
      status,
      scheduledFor:
        status === "scheduled" && scheduledFor
          ? new Date(scheduledFor).toISOString()
          : undefined,
      seo,
    };
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit ? `/api/admin/blog/posts/${initial!.id}` : "/api/admin/blog/posts",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/blog/posts");
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
            <Label>Category</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={selStyle}
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={field}>
          <Label>Author (optional)</Label>
          <Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Defaults to your account name"
            maxLength={120}
          />
        </div>
        <BilingualField
          label="Excerpt (optional)"
          value={excerpt}
          onChange={setExcerpt}
          textarea
        />
        <div style={field}>
          <Label>Cover image</Label>
          <SingleImage value={coverImage} onChange={setCoverImage} />
        </div>
      </section>

      <section style={card}>
        <div style={field}>
          <Label>Body (English)</Label>
          <RichTextEditor value={bodyEn} onChange={setBodyEn} />
        </div>
        <div style={field}>
          <Label>Body (বাংলা) — optional</Label>
          <RichTextEditor value={bodyBn} onChange={setBodyBn} />
        </div>
        <div style={field}>
          <Label>Body (日本語) — optional</Label>
          <RichTextEditor value={bodyJa} onChange={setBodyJa} />
        </div>
      </section>

      <section style={card}>
        <Label>Tags</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.length === 0 && (
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-sm)",
              }}
            >
              No tags yet — add some under Blog → Taxonomy.
            </span>
          )}
          {tags.map((tg) => {
            const on = tagIds.includes(tg.id);
            return (
              <button
                key={tg.id}
                type="button"
                onClick={() =>
                  setTagIds((ids) =>
                    on ? ids.filter((x) => x !== tg.id) : [...ids, tg.id],
                  )
                }
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-border)",
                  background: on
                    ? "var(--color-secondary-soft)"
                    : "var(--color-surface)",
                  color: on
                    ? "var(--color-secondary-deep)"
                    : "var(--color-text-muted)",
                  fontSize: "var(--fs-sm)",
                  cursor: "pointer",
                }}
              >
                {tg.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* SEO */}
      <section style={card}>
        <strong style={{ color: "var(--color-text-strong)" }}>
          SEO (optional)
        </strong>
        <BilingualField
          label="Meta title"
          value={metaTitle}
          onChange={setMetaTitle}
        />
        <BilingualField
          label="Meta description"
          value={metaDescription}
          onChange={setMetaDescription}
          textarea
        />
        <div style={field}>
          <Label>OG image</Label>
          <SingleImage value={ogImage} onChange={setOgImage} />
        </div>
      </section>

      {/* Publish */}
      <section style={card}>
        <div style={row}>
          <div style={field}>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BlogStatus)}
              style={selStyle}
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {status === "scheduled" && (
            <div style={field}>
              <Label>Publish at</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : isEdit ? "Save post" : "Create post"}
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
            <textarea
              placeholder="日本語"
              value={value.ja}
              onChange={(e) => onChange({ ...value, ja: e.target.value })}
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

function SingleImage({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) onChange(json.data.url);
  }
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {value && (
        <div
          style={{
            position: "relative",
            width: 120,
            height: 68,
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            border: "1px solid var(--color-border)",
          }}
        >
          <Image
            src={value}
            alt=""
            fill
            sizes="120px"
            style={{ objectFit: "cover" }}
          />
        </div>
      )}
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
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface)",
            color: "var(--color-error)",
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export function PostDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete "${title}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog/posts/${id}`, {
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
