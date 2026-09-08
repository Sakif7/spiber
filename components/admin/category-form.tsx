"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
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
import { formatApiError } from "@/lib/http/form-error";
import { LocalizedInput } from "@/components/admin/ui/localized-input";

const TOP_LEVEL = "__top__";

export function CategoryForm({
  storefront = "instruments",
  parents,
}: {
  storefront?: "instruments" | "marketplace";
  parents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
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
      storefront,
      parentId: parentId || undefined,
    };
    let json: {
      ok?: boolean;
      error?: { code?: string; message?: string };
    } | null = null;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setNameEn("");
        setNameBn("");
        setNameJa("");
        setSlug("");
        setParentId("");
        toast.success("Category created");
        router.refresh();
        setSaving(false);
        return;
      }
    } catch {
      /* fall through to error */
    }
    setSaving(false);
    const msg = formatApiError(json);
    setError(msg);
    toast.error(msg);
  }

  return (
    <div className="grid gap-5">
      <LocalizedInput
        label="Name"
        required
        value={{ en: nameEn, bn: nameBn, ja: nameJa }}
        onChange={(v) => {
          setNameEn(v.en ?? "");
          setNameBn(v.bn ?? "");
          setNameJa(v.ja ?? "");
        }}
      />
      <div className="grid gap-1.5">
        <Label>Slug</Label>
        <Input
          value={slug}
          placeholder="auto from name"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      {parents && (
        <div className="grid gap-1.5">
          <Label>Parent category</Label>
          <Select
            value={parentId === "" ? TOP_LEVEL : parentId}
            onValueChange={(v) => setParentId(v === TOP_LEVEL ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP_LEVEL}>— top level —</SelectItem>
              {parents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-destructive m-0 text-sm">{error}</p>}

      <div>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Create category"}
        </Button>
      </div>
    </div>
  );
}

export function DeleteCategoryButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete category"${name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        router.refresh();
        return;
      }
      window.alert(formatApiError(json, "delete_failed"));
    } catch {
      window.alert("delete_failed");
    } finally {
      setBusy(false);
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
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
