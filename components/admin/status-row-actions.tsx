"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Generic admin row action: PATCH an entity to a new status. Used by the
 * licenses and provisioning queues (small inline buttons in a table row).
 */
export function StatusRowActions({
  endpoint,
  actions,
}: {
  endpoint: string;
  actions: { to: string; label: string; danger?: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function set(to: string) {
    setBusy(to);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
    else window.alert("Action failed.");
  }

  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.to}
          type="button"
          size="sm"
          variant={a.danger ? "destructive" : "outline"}
          disabled={busy === a.to}
          onClick={() => set(a.to)}
        >
          {busy === a.to ? "…" : a.label}
        </Button>
      ))}
    </div>
  );
}
