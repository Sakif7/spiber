"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

const field: CSSProperties = { display: "grid", gap: 6 };
const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};

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
        name: { en: nameEn.trim(), bn: nameBn.trim() || undefined },
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      setNameEn("");
      setNameBn("");
      router.refresh();
    } else {
      setError(json?.error?.code ?? "save_failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-4)", maxWidth: 520 }}>
      <div style={field}>
        <Label>Name</Label>
        <div style={row}>
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
        </div>
      </div>
      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <CtaButton onClick={submit}>
        {saving ? "Saving…" : `Add ${label}`}
      </CtaButton>
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
    if (!window.confirm(`Delete "${name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog/${kind}/${id}`, {
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
