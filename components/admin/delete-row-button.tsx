"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Generic admin row delete button: confirms, DELETEs the given endpoint, then
 * refreshes the server component. Reused across Company admin lists (gallery,
 * events, career).
 */
export function DeleteRowButton({
  endpoint,
  title,
}: {
  endpoint: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete "${title}"?`)) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
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
