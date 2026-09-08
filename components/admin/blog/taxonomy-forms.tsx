"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/http/form-error";
import { LocalizedInput } from "@/components/admin/ui/localized-input";

function TaxonomyForm({
  endpoint,
  label,
}: {
  endpoint: string;
  label: string;
}) {
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nameEn.trim()) {
      setError("Name (EN) is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: {
          en: nameEn.trim(),
          bn: nameBn.trim() || undefined,
          ja: nameJa.trim() || undefined,
        },
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      setNameEn("");
      setNameBn("");
      setNameJa("");
      router.refresh();
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="grid max-w-[520px] gap-4">
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
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : `Add ${label}`}
        </Button>
      </div>
    </div>
  );
}

export function BlogCategoryForm() {
  return (
    <TaxonomyForm endpoint="/api/admin/blog/categories" label="category" />
  );
}
export function BlogTagForm() {
  return <TaxonomyForm endpoint="/api/admin/blog/tags" label="tag" />;
}

export function TaxonomyDeleteButton({
  kind,
  id,
  name,
}: {
  kind: "categories" | "tags";
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete"${name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog/${kind}/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else window.alert("delete_failed");
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={remove}
      disabled={busy}
      className="text-destructive hover:text-destructive"
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
