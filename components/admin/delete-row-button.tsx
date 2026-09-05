"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={remove}
      disabled={busy}
      aria-label={`Delete ${title}`}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 aria-hidden />
      {busy ? "…" : "Delete"}
    </Button>
  );
}
