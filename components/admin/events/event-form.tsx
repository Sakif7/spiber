"use client";

import { useState } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";
import type { EventStatus } from "@/lib/schemas/events";
import { LocalizedInput } from "@/components/admin/ui/localized-input";

type L = { en: string; bn: string; ja: string };

type LInit = { en: string; bn?: string; ja?: string };

export type EventFormInitial = {
  id?: string;
  title?: LInit;
  slug?: string;
  summary?: LInit;
  description?: LInit;
  coverImage?: string;
  startDate?: string; // datetime-local value
  endDate?: string;
  location?: LInit;
  registrationUrl?: string;
  status?: EventStatus;
};

const emptyL = (): L => ({ en: "", bn: "", ja: "" });
const toL = (l?: LInit): L =>
  l ? { en: l.en ?? "", bn: l.bn ?? "", ja: l.ja ?? "" } : emptyL();

export function EventForm({ initial }: { initial?: EventFormInitial }) {
  const afterSave = useAfterSave();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(toL(initial?.title));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [summary, setSummary] = useState<L>(toL(initial?.summary));
  const [description, setDescription] = useState<L>(toL(initial?.description));
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [location, setLocation] = useState<L>(toL(initial?.location));
  const [registrationUrl, setRegistrationUrl] = useState(
    initial?.registrationUrl ?? "",
  );
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "draft");
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
      afterSave("/admin/events");
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <div className="grid max-w-[860px] gap-5">
      <section className="bg-card grid gap-4 rounded-lg border p-5">
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
        <div className="grid gap-1.5">
          <Label>Cover image (optional)</Label>
          <SingleImageField value={coverImage} onChange={setCoverImage} />
        </div>
      </section>

      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Start date &amp; time</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>End date &amp; time (optional)</Label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <BilingualField
          label="Description"
          value={description}
          onChange={setDescription}
          textarea
          rows={6}
        />
      </section>

      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as EventStatus)}
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
          {saving ? "Saving…" : isEdit ? "Save event" : "Create event"}
        </Button>
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
  // Thin adapter over the shared tabbed field: the form keeps its `{en,bn,ja}`
  // state while the control renders one input behind an EN/বাংলা/日本語 tab strip.
  return (
    <LocalizedInput
      label={label}
      value={value}
      textarea={textarea}
      rows={rows}
      onChange={(v) =>
        onChange({ en: v.en ?? "", bn: v.bn ?? "", ja: v.ja ?? "" })
      }
    />
  );
}
