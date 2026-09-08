"use client";

import { useState, type FormEvent } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SingleImageField } from "@/components/admin/upload-fields";
import { formatApiError } from "@/lib/http/form-error";

/** What the edit panel prefills from. */
export type TestimonialInitial = {
  quote?: string;
  name?: string;
  role?: string;
  imageSrc?: string;
  tone?: string;
  category?: string;
  order?: number;
  published?: boolean;
};

export function TestimonialForm({
  id,
  initial = {},
}: {
  id?: string;
  initial?: TestimonialInitial;
}) {
  const afterSave = useAfterSave();
  const [quote, setQuote] = useState(initial.quote ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [role, setRole] = useState(initial.role ?? "");
  const [imageSrc, setImageSrc] = useState(initial.imageSrc ?? "");
  const [tone, setTone] = useState(initial.tone ?? "teal");
  const [category, setCategory] = useState(initial.category ?? "general");
  const [order, setOrder] = useState(String(initial.order ?? 0));
  const [published, setPublished] = useState(initial.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        quote,
        name,
        role,
        imageSrc,
        tone,
        category,
        order: Number(order) || 0,
        published,
      };
      const url = id
        ? `/api/admin/testimonials/${id}`
        : "/api/admin/testimonials";
      const res = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = formatApiError(json, "Could not save the testimonial.");
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Testimonial saved");
      // Editing in place stays put; creating goes back to the list.
      afterSave(id ? null : "/admin/testimonials");
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id || !window.confirm("Delete this testimonial?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json, "Could not delete."));
        return;
      }
      toast.success("Testimonial deleted");
      afterSave("/admin/testimonials");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-1.5">
        <Label htmlFor="t-quote">Quote</Label>
        <Textarea
          id="t-quote"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={5}
          placeholder="What the patient or partner said…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="t-name">Name</Label>
          <Input
            id="t-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-role">Role / designation</Label>
          <Input
            id="t-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Cardiac surgery · India"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Photo</Label>
        <SingleImageField value={imageSrc} onChange={setImageSrc} />
        <span className="text-muted-foreground text-xs">
          A square portrait works best in the carousel.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="t-category">Section</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="t-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Homepage</SelectItem>
              <SelectItem value="tourism">Tourism</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-tone">Accent</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger id="t-tone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teal">Teal</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="slate">Slate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-order">Order</Label>
          <Input
            id="t-order"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="t-published"
          checked={published}
          onCheckedChange={setPublished}
        />
        <Label htmlFor="t-published">Published (visible on the site)</Label>
      </div>

      {error && (
        <p role="alert" className="text-destructive m-0 text-sm">
          {error}
        </p>
      )}

      <div className="border-border flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Saving…" : id ? "Save changes" : "Create testimonial"}
        </Button>
        {id && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
