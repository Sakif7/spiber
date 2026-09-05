"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={remove}
      disabled={busy}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 aria-hidden />
      {busy ? "Deleting…" : "Delete banner"}
    </Button>
  );
}
