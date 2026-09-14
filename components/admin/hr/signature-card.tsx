"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailCard } from "@/components/admin/ui/detail";
import { ConfirmDialog } from "@/components/admin/company/file-manager/dialogs";
import { formatApiError } from "@/lib/http/form-error";
import { SignaturePicker } from "./signature-pad";

/**
 * The signature on file, with the ways to set, replace or remove it. Used
 * on the employee's page (admin) and in the portal (the person themself);
 * only the endpoint and the words differ.
 */
export function SignatureCard({
  endpoint,
  imageSrc,
  initial,
  self = false,
}: {
  /** GET/POST/DELETE the signature here. */
  endpoint: string;
  /** Where the current image is served from (cache-busted with the date). */
  imageSrc: string;
  initial: { updatedAt: string | null } | null;
  /** Portal wording ("your signature") instead of the admin's. */
  self?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [askRemove, setAskRemove] = useState(false);
  const who = self ? "your" : "their";

  async function save(png: string, source: "upload" | "draw") {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: png, source }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not save the signature."));
        return;
      }
      const updatedAt =
        json?.data?.signature?.updatedAt ?? new Date().toISOString();
      setCurrent({ updatedAt });
      toast.success(current ? "Signature replaced." : "Signature saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not remove the signature."));
        return;
      }
      setCurrent(null);
      setAskRemove(false);
      toast.success("Signature removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const when = current?.updatedAt
    ? new Date(current.updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <DetailCard
      title="Signature"
      description={
        self
          ? "Placed into documents when you acknowledge them. Stored encrypted; only you and the office can see it."
          : "Placed into a document's signature slot when they acknowledge it. Stored encrypted; replacing it is recorded."
      }
    >
      <div className="space-y-3">
        {current ? (
          <div className="bg-background flex h-28 items-center justify-center rounded-md border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- decrypted per request, never public */}
            <img
              src={`${imageSrc}?v=${encodeURIComponent(current.updatedAt ?? "")}`}
              alt={self ? "Your signature" : "Signature on file"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="text-muted-foreground bg-muted/40 flex h-28 items-center justify-center rounded-md border border-dashed text-center text-xs">
            {self
              ? "No signature yet — add one before you can sign a document."
              : "No signature on file. Upload an image or draw one; the person can also add it from their portal."}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SignaturePicker
            onPick={(png, source) => void save(png, source)}
            disabled={busy}
            uploadLabel={current ? "Replace with image" : "Upload image"}
            drawLabel={current ? "Draw a new one" : "Draw"}
          />
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={() => setAskRemove(true)}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
          )}
        </div>
        {when && (
          <p className="text-muted-foreground text-xs">Last changed {when}.</p>
        )}
      </div>
      <ConfirmDialog
        open={askRemove}
        title={`Remove ${who} signature?`}
        body="Documents already signed keep the signature they were signed with. New documents cannot be signed until a new one is added."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onCancel={() => setAskRemove(false)}
        onConfirm={() => void remove()}
      />
    </DetailCard>
  );
}
