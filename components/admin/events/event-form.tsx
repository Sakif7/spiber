"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";
import type { EventStatus } from "@/lib/schemas/events";

type L = { en: string; bn: string };

export type EventFormInitial = {
  id?: string;
  title?: L;
  slug?: string;
  summary?: L;
  description?: L;
  coverImage?: string;
  startDate?: string; // datetime-local value
  endDate?: string;
  location?: L;
  registrationUrl?: string;
  status?: EventStatus;
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

export function EventForm({ initial }: { initial?: EventFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(initial?.title ?? emptyL());
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [summary, setSummary] = useState<L>(initial?.summary ?? emptyL());
  const [description, setDescription] = useState<L>(
    initial?.description ?? emptyL(),
  );
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [location, setLocation] = useState<L>(initial?.location ?? emptyL());
  const [registrationUrl, setRegistrationUrl] = useState(
    initial?.registrationUrl ?? "",
  );
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function buildPayload() {
    const clean = (l: L) => ({ en: l.en.trim(), bn: l.bn.trim() || undefined });
    const optL = (l: L) => (l.en.trim() || l.bn.trim() ? clean(l) : undefined);
    return {
      title: clean(title),
      slug: slug.trim() || undefined,
      summary: optL(summary),
      description: clean(description),
      coverImage: coverImage || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      location: optL(location),
      registrationUrl: registrationUrl.trim() || undefined,
      status,
    };
  }

  async function submit() {
    if (!title.en.trim()) {
      setError("Please fix — Title (EN): is required");
      return;
    }
    if (!description.en.trim()) {
      setError("Please fix — Description (EN): is required");
      return;
    }
    if (!startDate) {
      setError("Please fix — Start date is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit ? `/api/admin/events/${initial!.id}` : "/api/admin/events",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/events");
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
            <Label>Registration link (optional)</Label>
            <Input
              value={registrationUrl}
              onChange={(e) => setRegistrationUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <BilingualField
          label="Summary (optional)"
          value={summary}
          onChange={setSummary}
          textarea
        />
        <BilingualField
          label="Location (optional)"
          value={location}
          onChange={setLocation}
        />
        <div style={field}>
          <Label>Cover image (optional)</Label>
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </div>
      </section>

      <section style={card}>
        <div style={row}>
          <div style={field}>
            <Label>Start date &amp; time</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={field}>
            <Label>End date &amp; time (optional)</Label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section style={card}>
        <BilingualField
          label="Description"
          value={description}
          onChange={setDescription}
          textarea
          rows={6}
        />
      </section>

      <section style={card}>
        <div style={field}>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus)}
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
          {saving ? "Saving…" : isEdit ? "Save event" : "Create event"}
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
  rows = 2,
}: {
  label: string;
  value: L;
  onChange: (v: L) => void;
  textarea?: boolean;
  rows?: number;
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
              rows={rows}
              style={taStyle}
            />
            <textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={rows}
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
