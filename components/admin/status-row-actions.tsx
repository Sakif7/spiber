"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

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
    <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {actions.map((a) => (
        <button
          key={a.to}
          type="button"
          disabled={busy === a.to}
          onClick={() => set(a.to)}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface)",
            color: a.danger ? "var(--color-error)" : "var(--color-brand-deep)",
            padding: "4px 10px",
            fontSize: "var(--fs-small)",
            cursor: busy === a.to ? "default" : "pointer",
            opacity: busy === a.to ? 0.6 : 1,
          }}
        >
          {busy === a.to ? "…" : a.label}
        </button>
      ))}
    </div>
  );
}
