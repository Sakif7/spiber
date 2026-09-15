"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/company/file-manager/dialogs";
import { formatApiError } from "@/lib/http/form-error";

/**
 * Unlock a sent document for changes. Spelled out because it starts a new
 * round: the filed versions and the signatures on them stay, but everyone
 * will be asked again once the changed text is sent.
 */
export function ReissueButton({
  documentId,
  number,
  pending,
}: {
  documentId: string;
  number: string | null;
  /** How many people have not acted on the current round. */
  pending: number;
}) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reissue() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/company/documents/${documentId}/reissue`,
        {
          method: "POST",
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not reissue the document."));
        return;
      }
      setAsk(false);
      toast.success(`${number ?? "The document"} is open for changes again.`);
      router.push(`/admin/company/documents/${documentId}/edit`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAsk(true)}
      >
        <RotateCcw className="size-4" aria-hidden />
        Reissue…
      </Button>
      <ConfirmDialog
        open={ask}
        title={`Reissue ${number ?? "this document"}?`}
        body={`The text unlocks for changes and keeps its number. Every filed version and the signatures on it stay in the vault. When you send it again, everyone is asked afresh${
          pending > 0
            ? ` — ${pending} ${pending === 1 ? "person has" : "people have"} not acted on the current round and will no longer be asked to`
            : ""
        }.`}
        confirmLabel="Reissue"
        busy={busy}
        onCancel={() => setAsk(false)}
        onConfirm={() => void reissue()}
      />
    </>
  );
}
