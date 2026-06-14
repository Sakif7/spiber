"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/http/form-error";

export function BrandForm() {
  const router = useRouter();

  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nameEn.trim()) {
      setError("Name (EN) is required");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: {
        en: nameEn.trim(),
        bn: nameBn.trim() || undefined,
        ja: nameJa.trim() || undefined,
      },
      slug: slug.trim() || undefined,
    };
    const res = await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      setNameEn("");
      setNameBn("");
      setNameJa("");
      setSlug("");
      toast.success("Brand added");
      router.refresh();
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="grid max-w-[520px] gap-4">
      <div className="grid gap-1.5">
        <Label>Name</Label>
        <div className="grid grid-cols-3 gap-4">
          <Input
            placeholder="EN"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <Input
            placeholder="বাংলা"
            value={nameBn}
            onChange={(e) => setNameBn(e.target.value)}
          />
          <Input
            placeholder="日本語"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Slug</Label>
        <Input
          value={slug}
          placeholder="auto from name"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Add brand"}
        </Button>
      </div>
    </div>
  );
}

export function BrandDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    const ok = window.confirm(`Delete brand "${name}"?`);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/brands/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      router.refresh();
    } else {
      window.alert(formatApiError(json, "delete_failed"));
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={remove}
      disabled={busy}
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
