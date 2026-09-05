"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/http/form-error";

/** Sends the low-stock digest email now (the same mail the daily cron sends). */
export function SendDigestButton({
  recipient,
  lastSentAt,
}: {
  recipient: string;
  lastSentAt: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch("/api/cron/low-stock-digest?force=1", {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json, "Could not send the digest"));
        return;
      }
      const d = json.data as { low: number; out: number; to: string };
      toast.success(`Digest sent to ${d.to}`, {
        description: `${d.out} out of stock · ${d.low} running low`,
      });
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const last = lastSentAt
    ? `Last sent ${new Date(lastSentAt).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : "Not sent yet";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={send}
      disabled={busy}
      title={`Emails the low-stock digest to ${recipient}. ${last}.`}
    >
      <Mail className="size-4" />
      {busy ? "Sending…" : "Send digest"}
    </Button>
  );
}
