"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

export function BrandForm() {
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
      setSlug("");
      router.refresh();
    } else {
      setError(json?.error?.message ?? json?.error?.code ?? "save_failed");
    }
  }

  const field = { display: "grid", gap: 6 } as const;
  const row = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--s-4)",
  } as const;

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
      <div style={field}>
        <Label>Slug</Label>
        <Input
          value={slug}
          placeholder="auto from name"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      <CtaButton onClick={submit}>{saving ? "Saving…" : "Add brand"}</CtaButton>
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
      window.alert(
        json?.error?.message ?? json?.error?.code ?? "delete_failed",
      );
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
