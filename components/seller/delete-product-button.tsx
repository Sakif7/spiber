"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (
      !window.confirm(
        "Delete this product? It will be removed from your store.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/seller/products/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        window.alert("Could not delete this product. Please try again.");
      }
    } catch {
      window.alert("Network error. Please try again.");
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
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-sm)",
        background: "var(--color-surface)",
        color: "var(--color-error)",
        padding: "6px 12px",
        fontSize: "var(--fs-small)",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
