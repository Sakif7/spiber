"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { formatApiError } from "@/lib/http/form-error";
import { formatBDT } from "@/lib/money";

/**
 * The money on a tourism quote: what it collects online, the pay link while it
 * is open, the payment once it is taken — and what we pass on to the hospital
 * or airline, which is the cost the sales report sets against it ("cost
 * missing" until it is typed).
 */
export function TourismMoneyCard({
  kind,
  id,
  quoteMinor,
  collectOnlineMinor,
  link,
  payment,
  passedOnMinor,
}: {
  kind: "medical_case" | "travel_request";
  id: string;
  quoteMinor: number | null;
  collectOnlineMinor: number | null;
  /** The open pay link, if the quote has one. */
  link: { url: string; amountMinor: number } | null;
  payment: {
    amountMinor: number;
    paidAt: string | null;
    reference: string | null;
  } | null;
  passedOnMinor: number | null;
}) {
  const router = useRouter();
  const [passedOn, setPassedOn] = useState(
    passedOnMinor != null ? String(passedOnMinor / 100) : "",
  );
  const [saving, setSaving] = useState(false);
  const to =
    kind === "medical_case" ? "the hospital" : "the airline or provider";

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  }

  async function save() {
    const typed = passedOn.trim();
    const taka = typed ? Number(typed) : null;
    if (taka != null && (!Number.isFinite(taka) || taka < 0)) {
      toast.error("Enter an amount in taka, or leave it empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/tourism/${kind === "medical_case" ? "cases" : "travel"}/${id}/passed-on`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passedOnMinor: taka == null ? null : Math.round(taka * 100),
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json, "That didn't work."));
        return;
      }
      toast.success("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DetailCard
      title="Money"
      action={
        payment && passedOnMinor == null ? (
          <StatusBadge tone="warning">Cost missing</StatusBadge>
        ) : null
      }
    >
      {quoteMinor != null ? (
        <DetailRow label="Quoted">{formatBDT(quoteMinor)}</DetailRow>
      ) : null}
      <DetailRow label="Collect online">
        {collectOnlineMinor ? formatBDT(collectOnlineMinor) : "Not offered"}
      </DetailRow>
      {payment ? (
        <DetailRow label="Paid online">
          {formatBDT(payment.amountMinor)}
          {payment.paidAt
            ? ` · ${new Date(payment.paidAt).toLocaleDateString()}`
            : ""}
          {payment.reference ? ` · ${payment.reference}` : ""}
        </DetailRow>
      ) : link ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`pay-link-${id}`}>
            Pay link ({formatBDT(link.amountMinor)})
          </Label>
          <div className="flex gap-2">
            <Input
              id={`pay-link-${id}`}
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy link"
              onClick={() => void copy(link.url)}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-1.5 border-t pt-3">
        <Label htmlFor={`passed-on-${id}`}>{`Passed on to ${to} (BDT)`}</Label>
        <div className="flex gap-2">
          <Input
            id={`passed-on-${id}`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={passedOn}
            onChange={(e) => setPassedOn(e.target.value)}
            placeholder="What we pay out of what we collected"
            className="min-w-0"
          />
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="text-muted-foreground m-0 text-xs">
          The sales report counts what we collect as revenue and this as its
          cost.
        </p>
      </div>
    </DetailCard>
  );
}
