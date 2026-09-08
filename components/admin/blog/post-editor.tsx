"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { formatApiError } from "@/lib/http/form-error";
import type { BlogStatus } from "@/lib/schemas/blog";
import { LocalizedInput, type LocalizedValue } from "../ui/localized-input";
import { SelectField } from "../ui/select-field";
import {
  EditorForm,
  FormField,
  FormGrid,
  FormSection,
  SaveBar,
} from "../ui/form-shell";
import { SingleImageField } from "../upload-fields";
import { Segmented, TogglePill } from "@/components/admin/ui/segmented";

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
/** LocalizedInput hands back a partial value; the payload builder wants all three. */
const fromLV = (v: LocalizedValue): L => ({
  en: v.en ?? "",
  bn: v.bn ?? "",
  ja: v.ja ?? "",
});

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** Body locales, matched to the LocalizedInput tab strip. */
const BODY_TABS = [
  { key: "en", label: "EN" },
  { key: "bn", label: "বাংলা" },
  { key: "ja", label: "日本語" },
] as const;

export function PostEditor({
  initial,
  categories,
  tags,
}: {
  initial?: PostEditorInitial;
  categories: Opt[];
  tags: Opt[];
}) {
  const afterSave = useAfterSave();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(fillL(initial?.title));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState<L>(fillL(initial?.excerpt));
  const [bodyEn, setBodyEn] = useState(initial?.bodyEn ?? "");
  const [bodyBn, setBodyBn] = useState(initial?.bodyBn ?? "");
  const [bodyJa, setBodyJa] = useState(initial?.bodyJa ?? "");
  const [bodyTab, setBodyTab] = useState<"en" | "bn" | "ja">("en");
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
      afterSave("/admin/blog/posts");
    } else {
      setError(formatApiError(json));
    }
  }

  const bodyFilled: Record<string, boolean> = {
    en: Boolean(bodyEn.replace(/<[^>]*>/g, "").trim()),
    bn: Boolean(bodyBn.replace(/<[^>]*>/g, "").trim()),
    ja: Boolean(bodyJa.replace(/<[^>]*>/g, "").trim()),
  };

  return (
    <EditorForm className="max-w-5xl">
      <FormSection
        title="Post"
        description="Title, excerpt and where the post is filed."
      >
        <LocalizedInput
          label="Title"
          required
          value={title}
          onChange={(v) => setTitle(fromLV(v))}
          placeholder="e.g. Choosing a patient monitor"
        />
        <FormGrid>
          <FormField
            label="Slug (optional)"
            htmlFor="post-slug"
            hint="Leave blank to derive it from the English title."
          >
            <Input
              id="post-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </FormField>
          <FormField label="Category">
            <SelectField
              value={categoryId}
              onChange={setCategoryId}
              ariaLabel="Category"
              emptyLabel="— none —"
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </FormField>
        </FormGrid>
        <FormField
          label="Author (optional)"
          htmlFor="post-author"
          hint="A byline that overrides your account name. The original author is preserved when someone else edits."
        >
          <Input
            id="post-author"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Defaults to your account name"
            maxLength={120}
          />
        </FormField>
        <LocalizedInput
          label="Excerpt (optional)"
          textarea
          rows={2}
          value={excerpt}
          onChange={(v) => setExcerpt(fromLV(v))}
          hint="Derived from the body when left blank."
        />
        <FormField label="Cover image">
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </FormField>
      </FormSection>

      <FormSection
        title="Body"
        description="English is required; the translations are optional and fall back to English."
        action={
          <Segmented
            value={bodyTab}
            onChange={setBodyTab}
            label="Body language"
            options={BODY_TABS.map((t) => ({
              value: t.key,
              label: t.label,
              dot: bodyFilled[t.key],
            }))}
          />
        }
      >
        {/* All three stay mounted so switching a tab never resets the editor. */}
        <div hidden={bodyTab !== "en"}>
          <RichTextEditor value={bodyEn} onChange={setBodyEn} />
        </div>
        <div hidden={bodyTab !== "bn"}>
          <RichTextEditor value={bodyBn} onChange={setBodyBn} />
        </div>
        <div hidden={bodyTab !== "ja"}>
          <RichTextEditor value={bodyJa} onChange={setBodyJa} />
        </div>
      </FormSection>

      <FormSection
        title="Tags"
        description="Tags drive the related-posts rail and the tag archive pages."
      >
        {tags.length === 0 ? (
          <p className="text-muted-foreground">
            No tags yet — add some under Blog → Taxonomy.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tg) => {
              const on = tagIds.includes(tg.id);
              return (
                <TogglePill
                  key={tg.id}
                  active={on}
                  onClick={() =>
                    setTagIds((ids) =>
                      on ? ids.filter((x) => x !== tg.id) : [...ids, tg.id],
                    )
                  }
                >
                  {tg.name}
                </TogglePill>
              );
            })}
          </div>
        )}
      </FormSection>

      <FormSection
        title="SEO"
        description="Optional. Falls back to the post title and excerpt."
      >
        <LocalizedInput
          label="Meta title"
          value={metaTitle}
          onChange={(v) => setMetaTitle(fromLV(v))}
        />
        <LocalizedInput
          label="Meta description"
          textarea
          rows={2}
          value={metaDescription}
          onChange={(v) => setMetaDescription(fromLV(v))}
        />
        <FormField label="OG image">
          <SingleImageField value={ogImage} onChange={setOgImage} />
        </FormField>
      </FormSection>

      <FormSection
        title="Publishing"
        description="A scheduled post becomes visible once its publish time passes — no cron needed."
      >
        <FormGrid>
          <FormField label="Status">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as BlogStatus)}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
            />
          </FormField>
          {status === "scheduled" && (
            <FormField label="Publish at" htmlFor="post-scheduled">
              <Input
                id="post-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </FormField>
          )}
        </FormGrid>
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={submit}
        error={error}
        saveLabel={isEdit ? "Save post" : "Create post"}
      />
    </EditorForm>
  );
}

export function PostDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete"${title}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog/posts/${id}`, {
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
