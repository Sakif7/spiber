"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";

export function ReviewModeration({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function moderate(status: "approved" | "rejected") {
    setBusy(status);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(json?.error?.code ?? "failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <CtaButton onClick={() => moderate("approved")}>
        {busy === "approved" ? "…" : "Approve"}
      </CtaButton>
      <CtaButton variant="secondary" onClick={() => moderate("rejected")}>
        {busy === "rejected" ? "…" : "Reject"}
      </CtaButton>
    </div>
  );
}
