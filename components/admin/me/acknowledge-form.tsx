"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailCard } from "@/components/admin/ui/detail";
import { formatApiError } from "@/lib/http/form-error";

/**
 * The act of acknowledging: the person types their name as it is on their
 * record and ticks that they have read it. A signer's stored signature is
 * then placed into their slot by the server.
 */
export function AcknowledgeForm({
  documentId,
  role,
  employeeName,
  hasSignature,
}: {
  documentId: string;
  role: "sign" | "acknowledge";
  employeeName: string;
  hasSignature: boolean;
}) {
  const router = useRouter();
  const [typedName, setTypedName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { completed: boolean }>(null);
  const signing = role === "sign";
  const needsSignature = signing && !hasSignature;

  async function submit() {
    setError(null);
    if (
      typedName.trim().toLowerCase().replace(/\s+/g, " ") !==
      employeeName.trim().toLowerCase().replace(/\s+/g, " ")
    ) {
      setError(`Type your name exactly as on your record: ${employeeName}`);
      return;
    }
    if (!agree) {
      setError("Tick the box to confirm you have read it.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/me/documents/${documentId}/acknowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typedName: typedName.trim(), agree: true }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = json?.error?.code as string | undefined;
        setError(
          code === "name_mismatch"
            ? `Type your name exactly as on your record: ${employeeName}`
            : code === "no_signature"
              ? "Add your signature first — it is what gets placed on the document."
              : code === "not_pending"
                ? "This document has already been acknowledged."
                : formatApiError(
                    json,
                    "Could not record your acknowledgement.",
                  ),
        );
        return;
      }
      setDone({ completed: Boolean(json?.data?.completed) });
      toast.success(signing ? "Signed." : "Acknowledged.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <DetailCard title={signing ? "Signed" : "Acknowledged"}>
        <div className="flex items-start gap-3 text-sm">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-[var(--tone-success-fg)]"
            aria-hidden
          />
          <p className="text-muted-foreground">
            {signing
              ? "Your signature has been placed on the document."
              : "Your acknowledgement has been recorded."}{" "}
            {done.completed
              ? "Everyone has acted, so the signed copy is now filed."
              : "The office is told; the signed copy is filed once everyone has acted."}
          </p>
        </div>
      </DetailCard>
    );
  }

  return (
    <DetailCard
      title={signing ? "Read and sign" : "Acknowledge"}
      description={
        signing
          ? "Your stored signature is placed into your slot on the document."
          : "Confirms to the office that you have read it."
      }
    >
      {needsSignature ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            You have no signature on file yet. Add one, then come back here to
            sign.
          </p>
          <Button asChild size="sm">
            <Link href="/admin/me/signature">
              <PenLine className="size-4" aria-hidden />
              Add my signature
            </Link>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="ack-name">Type your full name</Label>
            <Input
              id="ack-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={employeeName}
              autoComplete="off"
              maxLength={160}
              aria-invalid={Boolean(error)}
            />
            <p className="text-muted-foreground text-xs">
              As on your record: {employeeName}
            </p>
          </div>
          <Label className="flex items-start gap-2 font-normal">
            <Checkbox
              checked={agree}
              onCheckedChange={(c) => setAgree(c === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              I have read this document
              {signing ? " and sign it with the signature I have on file" : ""}.
            </span>
          </Label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <PenLine className="size-4" aria-hidden />
            )}
            {signing ? "Acknowledge and sign" : "Acknowledge"}
          </Button>
        </form>
      )}
    </DetailCard>
  );
}
