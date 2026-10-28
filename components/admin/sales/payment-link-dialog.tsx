"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatApiError } from "@/lib/http/form-error";
import { formatBDT } from "@/lib/money";
import type { PaymentLinkBasis } from "@/lib/schemas/payment";

type LinkAmount = { amountMinor: number; roundingMinor: number };

/** The order's pay link as the dialog shows it (plain, serializable). */
export type PaymentLinkInfo = {
  /** Online payment for Sales invoices is on (gateway live, switch on). */
  available: boolean;
  totalMinor: number;
  /** AIT + VDS on record; 0 means there is nothing to choose. */
  withheldMinor: number;
  /** What each choice asks for; `less` is null with nothing on record. */
  full: LinkAmount;
  less: LinkAmount | null;
  /** The link that can still be paid, if there is one. */
  open: {
    url: string;
    amountMinor: number;
    basis: PaymentLinkBasis;
    email: string;
    sentTo: { email: string; at: string }[];
    /** The amount owed has changed since it was made. */
    outdated: boolean;
  } | null;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Make, copy, email or withdraw the order's pay link. The client pays on our
 * own page (`/pay/<token>`), which hands each try to PayStation; whichever try
 * settles marks the order paid on its own.
 *
 * With AIT on record the dialog asks every time whether the link is for the
 * full total or the total less the AIT (owner, 2026-10-28) — nothing is
 * chosen for them, except by a link that already exists.
 */
export function PaymentLinkDialog({
  orderId,
  open,
  onOpenChange,
  leadEmail,
  link,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadEmail: string | null;
  link: PaymentLinkInfo;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "make" | "send" | "cancel">(null);
  const [email, setEmail] = useState(link.open?.email ?? leadEmail ?? "");
  const [confirmRecipient, setConfirmRecipient] = useState(false);
  const current = link.open && !link.open.outdated ? link.open : null;
  const [picked, setPicked] = useState<PaymentLinkBasis | null>(
    current?.basis ?? null,
  );
  // Nothing on record: the link can only be for the total.
  const basis: PaymentLinkBasis | null = link.less ? picked : "full";
  const amount =
    basis === "full"
      ? link.full
      : basis === "less_withholding"
        ? link.less
        : null;
  const matches = !!current && current.basis === basis;
  const differs =
    !!leadEmail &&
    email.trim().toLowerCase() !== leadEmail.toLowerCase() &&
    email.trim() !== "";

  async function call(
    body: Record<string, unknown>,
    kind: "make" | "send" | "cancel",
  ): Promise<{ url?: string } | null> {
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/company/sales/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code;
        toast.error(
          code === "recipient_mismatch"
            ? "That is not the client's address. Tick the box to send it anyway."
            : code === "payment_unavailable"
              ? "Online payment for Sales invoices is switched off."
              : code === "basis_required"
                ? "Choose what the link asks for first."
                : formatApiError(json, "That didn't work."),
        );
        return null;
      }
      router.refresh();
      return json.data ?? {};
    } finally {
      setBusy(null);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  }

  async function make() {
    const data = await call(
      { action: "payment-link", email: email.trim(), basis },
      "make",
    );
    if (data?.url) await copy(data.url);
  }

  async function send() {
    const data = await call(
      {
        action: "payment-link",
        email: email.trim(),
        basis,
        send: true,
        confirmRecipient,
      },
      "send",
    );
    if (data) {
      toast.success(`Payment link emailed to ${email.trim()}.`);
      onOpenChange(false);
    }
  }

  async function withdraw() {
    const data = await call({ action: "payment-link-cancel" }, "cancel");
    if (data)
      toast.success(
        "Payment link withdrawn. The client's copy no longer works.",
      );
  }

  const rounding = (a: LinkAmount | null) =>
    a && a.roundingMinor !== 0
      ? ` · rounding −${formatBDT(-a.roundingMinor)}`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment link</DialogTitle>
          <DialogDescription>
            The client pays online — bKash, Nagad, Rocket, Upay or card — and
            this invoice is marked paid by itself.
          </DialogDescription>
        </DialogHeader>

        {!link.available ? (
          <p className="text-muted-foreground text-sm">
            Online payment for Sales invoices is switched off. Turn on{" "}
            <em>Sales invoice payment links</em> in{" "}
            <Link
              href="/admin/company/payments/settings"
              className="text-primary hover:underline"
            >
              Company › Online payments
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3">
            {link.less ? (
              <fieldset className="grid gap-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  What should the link ask for?
                </legend>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="pl-basis"
                    className="mt-1"
                    checked={picked === "full"}
                    onChange={() => setPicked("full")}
                  />
                  <span>
                    <strong>
                      Full total — {formatBDT(link.full.amountMinor)}
                    </strong>
                    <span className="text-muted-foreground block text-xs">
                      {`The client pays everything. AIT withheld (${formatBDT(link.withheldMinor)} on record) becomes ৳0 when it is paid${rounding(link.full)}.`}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="pl-basis"
                    className="mt-1"
                    checked={picked === "less_withholding"}
                    onChange={() => setPicked("less_withholding")}
                  />
                  <span>
                    <strong>
                      Less the AIT on record —{" "}
                      {formatBDT(link.less.amountMinor)}
                    </strong>
                    <span className="text-muted-foreground block text-xs">
                      {`Invoice total ${formatBDT(link.totalMinor)} less the ${formatBDT(link.withheldMinor)} the client deducts at source${rounding(link.less)}.`}
                    </span>
                  </span>
                </label>
              </fieldset>
            ) : (
              <div className="bg-muted/40 grid gap-1 rounded-md border p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Invoice total</span>
                  <span className="tabular-nums">
                    {formatBDT(link.totalMinor)}
                  </span>
                </div>
                {link.full.roundingMinor !== 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Rounding</span>
                    <span className="tabular-nums">
                      −{formatBDT(-link.full.roundingMinor)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
                  <span>The link asks for</span>
                  <span className="tabular-nums">
                    {formatBDT(link.full.amountMinor)}
                  </span>
                </div>
              </div>
            )}

            {link.open?.outdated ? (
              <p className="text-sm text-[var(--tone-warning-fg)]">
                {`The link already sent asks for ${formatBDT(link.open.amountMinor)}, which is no longer what is owed. Making a new one withdraws it.`}
              </p>
            ) : current && basis && !matches ? (
              <p className="text-sm text-[var(--tone-warning-fg)]">
                {`The link already made asks for ${formatBDT(current.amountMinor)}. Making one for ${formatBDT(amount?.amountMinor ?? 0)} withdraws it.`}
              </p>
            ) : null}

            {current && matches ? (
              <div className="grid gap-1.5">
                <Label htmlFor="pl-url">Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="pl-url"
                    readOnly
                    value={current.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copy link"
                    onClick={() => void copy(current.url)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                {current.sentTo.length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Sent to{" "}
                    {current.sentTo
                      .map((s) => `${s.email} (${fmt(s.at)})`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="pl-email">Client email</Label>
              <Input
                id="pl-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setConfirmRecipient(false);
                }}
              />
              <p className="text-muted-foreground text-xs">
                PayStation sends the receipt here.
              </p>
              {differs ? (
                <label className="text-muted-foreground flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={confirmRecipient}
                    onChange={(e) => setConfirmRecipient(e.target.checked)}
                    className="mt-0.5"
                  />
                  {`This is not the address on the lead (${leadEmail}). Send it anyway.`}
                </label>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {link.open ? (
            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy !== null}
              onClick={() => void withdraw()}
            >
              {busy === "cancel" && <Loader2 className="size-4 animate-spin" />}
              Withdraw link
            </Button>
          ) : (
            <span />
          )}
          {link.available ? (
            <div className="flex gap-2">
              {!matches ? (
                <Button
                  variant="outline"
                  disabled={busy !== null || !basis || !email.trim()}
                  onClick={() => void make()}
                >
                  {busy === "make" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Make link
                </Button>
              ) : null}
              <Button
                disabled={busy !== null || !basis || !email.trim()}
                className="gap-1.5"
                onClick={() => void send()}
              >
                {busy === "send" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Email to client
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
