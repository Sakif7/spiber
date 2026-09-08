"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DetailCard } from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { formatApiError } from "@/lib/http/form-error";
import {
  SALES_LEAD_TRANSITIONS,
  type SalesLeadStatus,
} from "@/lib/schemas/sales-lead";

const label = (s: string) =>
  s.replace(/_/g, "").replace(/^./, (c) => c.toUpperCase());

/**
 * Move a lead through its pipeline by hand. Orders advance it automatically as
 * they progress; this is for the calls and meetings in between.
 */
export function LeadStatusPanel({
  id,
  status,
}: {
  id: string;
  status: SalesLeadStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = SALES_LEAD_TRANSITIONS[status] ?? [];

  async function move(to: SalesLeadStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/sales/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not change the status."));
        return;
      }
      toast.success(`Moved to ${label(to)}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailCard title="Status">
      <StatusBadge tone={statusTone(status)}>{label(status)}</StatusBadge>
      {next.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {next.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => move(s)}
            >
              {label(s)}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          This lead is settled.
        </p>
      )}
    </DetailCard>
  );
}
