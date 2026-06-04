"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { formatApiError } from "@/lib/http/form-error";

export function CategoryForm() {
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
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
      name: { en: nameEn.trim(), bn: nameBn.trim() || undefined },
      slug: slug.trim() || undefined,
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
        setSlug("");
        router.refresh();
        setSaving(false);
        return;
      }
    } catch {
      /* fall through to error */
    }
    setSaving(false);
    setError(formatApiError(json));
  }

  const field = { display: "grid", gap: 6 } as const;
  const row = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--s-4)",
  } as const;

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
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
      <div style={field}>
        <Label>Slug</Label>
        <Input
          value={slug}
          placeholder="auto from name"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--color-error)" }}>{error}</p>
      )}

      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : "Create category"}
        </CtaButton>
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
    if (!window.confirm(`Delete category "${name}"?`)) return;
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
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      style={{
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-sm)",
        color: "var(--color-error)",
        padding: "4px 12px",
        fontSize: "var(--fs-small)",
        fontFamily: "inherit",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
