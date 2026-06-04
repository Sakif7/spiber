"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatApiError } from "@/lib/http/form-error";

export function BannerDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (!window.confirm("Delete this banner?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        router.push("/admin/marketplace/banners");
        router.refresh();
        return;
      }
      window.alert(formatApiError(json, "delete_failed"));
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
        padding: "8px 16px",
        fontSize: "var(--fs-small)",
        fontFamily: "inherit",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Deleting…" : "Delete banner"}
    </button>
  );
}
