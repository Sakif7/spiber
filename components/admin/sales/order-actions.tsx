"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailCard } from "@/components/admin/ui/detail";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";
import {
  SALES_ORDER_TRANSITIONS,
  SALES_ORDER_STATUS_LABEL,
  type SalesOrderStatus,
  type SalesPaymentMethod,
} from "@/lib/schemas/sales-order";
import { nextAction } from "@/lib/sales/journey";

export type VersionRow = {
  version: number;
  generatedAt: string;
  invoiceNumber?: string | null;
  emailedTo: string[];
  emailedAt: string | null;
  superseded: boolean;
};

type Dialogs =
  | { kind: "none" }
  | { kind: "proposal" }
  | { kind: "invoice" }
  | { kind: "payment" }
  | { kind: "send"; docKind: "proposal" | "invoice"; version: number };

/**
 * Everything an admin does to a sales order once it exists: move it along,
 * produce the documents, email them, and record the money.
 */
export function OrderActions({
  id,
  status,
  paymentStatus,
  leadEmail,
  proposals,
  invoices,
  defaultPaymentDays,
  blockers = [],
}: {
  id: string;
  status: SalesOrderStatus;
  paymentStatus: "unpaid" | "paid";
  leadEmail: string | null;
  proposals: VersionRow[];
  invoices: VersionRow[];
  defaultPaymentDays: number;
  /** Reasons the next step cannot run yet; disables the primary action. */
  blockers?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });

  // Proposal fields
  const [subject, setSubject] = useState(
    "Proposal for Medical and Surgical Consumables",
  );
  const [intro, setIntro] = useState("");
  // Invoice fields
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentDays, setPaymentDays] = useState(String(defaultPaymentDays));
  // Payment fields
  const [method, setMethod] = useState<SalesPaymentMethod>("bank");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  // Send fields
  const [to, setTo] = useState(leadEmail ?? "");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [confirmRecipient, setConfirmRecipient] = useState(false);

  async function post(body: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/sales/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "That didn't work."));
        return null;
      }
      toast.success(okMessage);
      setDialog({ kind: "none" });
      router.refresh();
      return json?.data ?? true;
    } finally {
      setBusy(false);
    }
  }

  const next = SALES_ORDER_TRANSITIONS[status] ?? [];

  /**
   * The step this order is actually waiting on, and everything else it could
   * legally do. The primary button runs the first; the menu holds the rest,
   * including the reverts and the cancel.
   */
  const primary = nextAction(status, paymentStatus);
  const blocked = blockers.length > 0;
  const otherMoves = next.filter((s) => s !== primary.to);

  function runPrimary() {
    if (blocked) return;
    if (primary.kind === "proposal") return setDialog({ kind: "proposal" });
    if (primary.kind === "payment") return setDialog({ kind: "payment" });
    if (primary.kind === "transition" && primary.to) {
      const to = primary.to;
      void post(
        { action: "transition", to },
        `Moved to ${SALES_ORDER_STATUS_LABEL[to].toLowerCase()}.`,
      );
    }
  }
  const docHref = (kind: string, version: number, download = false) =>
    `/api/admin/company/sales/orders/${id}/documents/${kind}/${version}${download ? "?download=1" : ""}`;

  return (
    <>
      <DetailCard title="Status">
        {/* ONE primary action. Everything else an order can legally do stays
            available in the menu beside it — a column of eight equal buttons
            told nobody which one to press. */}
        <div className="flex items-center gap-2">
          {primary.kind !== "none" ? (
            <Button
              className="flex-1"
              disabled={busy || blocked}
              title={blocked ? blockers.join("") : undefined}
              onClick={runPrimary}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {primary.label}
            </Button>
          ) : (
            <p className="text-muted-foreground flex-1 text-xs">
              {status === "cancelled"
                ? "This order was cancelled."
                : "This order is complete."}
            </p>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Documents</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setDialog({ kind: "proposal" })}
              >
                <FileText className="size-4" />
                {proposals.length > 0
                  ? "Regenerate proposal"
                  : "Generate proposal"}
              </DropdownMenuItem>
              {(status === "invoiced" || status === "delivered") && (
                <DropdownMenuItem
                  onSelect={() => setDialog({ kind: "invoice" })}
                >
                  <FileText className="size-4" />
                  {invoices.length > 0
                    ? "Regenerate invoice"
                    : "Generate invoice"}
                </DropdownMenuItem>
              )}

              {status !== "draft" && status !== "cancelled" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Payment</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => setDialog({ kind: "payment" })}
                  >
                    {paymentStatus === "paid"
                      ? "Reverse payment"
                      : "Record payment"}
                  </DropdownMenuItem>
                </>
              )}

              {otherMoves.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {otherMoves.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      variant={s === "cancelled" ? "destructive" : "default"}
                      onSelect={() =>
                        post(
                          { action: "transition", to: s },
                          `Moved to ${SALES_ORDER_STATUS_LABEL[s].toLowerCase()}.`,
                        )
                      }
                    >
                      {SALES_ORDER_STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DetailCard>

      <DocumentList
        title="Proposals"
        kind="proposal"
        rows={proposals}
        docHref={docHref}
        onSend={(version) => {
          setMailSubject("Proposal from Spiber Med Limited");
          setMailBody(
            "Please find our proposal attached. We look forward to hearing from you.",
          );
          setTo(leadEmail ?? "");
          setConfirmRecipient(false);
          setDialog({ kind: "send", docKind: "proposal", version });
        }}
      />
      <DocumentList
        title="Invoices"
        kind="invoice"
        rows={invoices}
        docHref={docHref}
        onSend={(version) => {
          setMailSubject("Invoice from Spiber Med Limited");
          setMailBody("Please find our invoice attached.");
          setTo(leadEmail ?? "");
          setConfirmRecipient(false);
          setDialog({ kind: "send", docKind: "invoice", version });
        }}
      />

      {/* Generate proposal */}
      <Dialog
        open={dialog.kind === "proposal"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate proposal</DialogTitle>
            <DialogDescription>
              A new version is produced and filed in the company documents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-subject">Subject</Label>
              <Input
                id="p-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-intro">Opening paragraph</Label>
              <Textarea
                id="p-intro"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                placeholder="Leave blank to use the standard wording."
                maxLength={1500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                post(
                  { action: "proposal", subject, intro },
                  "Proposal generated.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate invoice */}
      <Dialog
        open={dialog.kind === "invoice"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
            <DialogDescription>
              This takes the next invoice number in the series.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="i-date">Invoice date</Label>
              <Input
                id="i-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="i-delivery">Delivery date</Label>
              <Input
                id="i-delivery"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="i-days">Payment days</Label>
              <Input
                id="i-days"
                value={paymentDays}
                onChange={(e) => setPaymentDays(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                post(
                  {
                    action: "invoice",
                    invoiceDate: new Date(invoiceDate).toISOString(),
                    deliveryDate: deliveryDate
                      ? new Date(deliveryDate).toISOString()
                      : undefined,
                    paymentDays: Number(paymentDays) || undefined,
                  },
                  "Invoice generated.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog
        open={dialog.kind === "payment"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {paymentStatus === "paid" ? "Reverse payment" : "Record payment"}
            </DialogTitle>
          </DialogHeader>
          {paymentStatus === "paid" ? (
            <p className="text-muted-foreground text-sm">
              This takes the order back out of the revenue figures.
            </p>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pay-date">Received on</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Method</Label>
                <SelectField
                  value={method}
                  onChange={(v) => setMethod(v as SalesPaymentMethod)}
                  options={[
                    { value: "bank", label: "Bank transfer" },
                    { value: "cheque", label: "Cheque" },
                    { value: "cash", label: "Cash" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pay-ref">Reference</Label>
                <Input
                  id="pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Cheque or transaction number"
                  maxLength={120}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              variant={paymentStatus === "paid" ? "destructive" : "default"}
              onClick={() =>
                post(
                  paymentStatus === "paid"
                    ? { action: "payment", status: "unpaid" }
                    : {
                        action: "payment",
                        status: "paid",
                        method,
                        reference,
                        paidAt: new Date(paidAt).toISOString(),
                      },
                  paymentStatus === "paid"
                    ? "Payment reversed."
                    : "Payment recorded.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {paymentStatus === "paid" ? "Reverse" : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email a document */}
      <Dialog
        open={dialog.kind === "send"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email the document</DialogTitle>
            <DialogDescription>
              The PDF is attached, and the sales inbox is copied in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="s-to">To</Label>
              <Input
                id="s-to"
                type="email"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setConfirmRecipient(false);
                }}
              />
              {leadEmail &&
                to.trim().toLowerCase() !== leadEmail.toLowerCase() && (
                  <label className="text-muted-foreground flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={confirmRecipient}
                      onChange={(e) => setConfirmRecipient(e.target.checked)}
                      className="mt-0.5"
                    />
                    This is not the address on the lead ({leadEmail}). Send it
                    anyway.
                  </label>
                )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-subject">Subject</Label>
              <Input
                id="s-subject"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-body">Message</Label>
              <Textarea
                id="s-body"
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                rows={5}
                maxLength={5000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !to.trim()}
              className="gap-1.5"
              onClick={() =>
                dialog.kind === "send" &&
                post(
                  {
                    action: "send",
                    kind: dialog.docKind,
                    version: dialog.version,
                    to,
                    subject: mailSubject,
                    body: mailBody,
                    confirmRecipient,
                  },
                  "Email sent.",
                )
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentList({
  title,
  kind,
  rows,
  docHref,
  onSend,
}: {
  title: string;
  kind: "proposal" | "invoice";
  rows: VersionRow[];
  docHref: (kind: string, version: number, download?: boolean) => string;
  onSend: (version: number) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <DetailCard title={title}>
      <div className="grid gap-2">
        {[...rows].reverse().map((v) => (
          <div
            key={v.version}
            className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {v.invoiceNumber ? (
                  <span className="font-mono text-xs">{v.invoiceNumber}</span>
                ) : (
                  `Version ${v.version}`
                )}
                {v.superseded && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    superseded
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                {new Date(v.generatedAt).toLocaleString()}
                {v.emailedAt
                  ? ` · sent to ${v.emailedTo.join(",")}`
                  : " · not sent"}
              </p>
            </div>
            <div className="flex gap-1">
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <a
                  href={docHref(kind, v.version)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="size-4" />
                  Open
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <a href={docHref(kind, v.version, true)}>
                  <Download className="size-4" />
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => onSend(v.version)}
              >
                <Mail className="size-4" />
                Email
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DetailCard>
  );
}
