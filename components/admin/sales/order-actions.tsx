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
import { Truck, Copy, Receipt } from "lucide-react";
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
import { nextAction, goesBackwards } from "@/lib/sales/journey";
import {
  type EquipmentTerms,
  type SalesOrderKind,
} from "@/lib/sales/equipment";
import {
  EquipmentProposalFields,
  equipmentProposalDraft,
  type EquipmentProposalDraft,
} from "./equipment-proposal-fields";
import {
  useUnsavedChanges,
  hasUnsavedChanges,
  saveUnsavedChanges,
} from "@/components/admin/ui/unsaved-changes";

/** The three documents an order produces. */
type DocKind = "proposal" | "invoice" | "challan";

export type VersionRow = {
  version: number;
  /**
   * The order has been amended since this was produced, so the figures on it
   * are no longer the ones the order holds. Worth saying out loud: the whole
   * point of a stored version is that it does NOT follow the order, and
   * without a mark there is nothing to tell one apart from a current one.
   */
  stale?: boolean;
  generatedAt: string;
  invoiceNumber?: string | null;
  emailedTo: string[];
  emailedAt: string | null;
  /** The PDF template it was drawn with; 0 = the built-in layout. */
  templateVersion?: number;
  superseded: boolean;
};

type Dialogs =
  | { kind: "none" }
  | { kind: "proposal" }
  | { kind: "invoice" }
  | { kind: "withholding" }
  | { kind: "payment" }
  | { kind: "send"; docKind: DocKind; version: number }
  | { kind: "revert"; to: SalesOrderStatus }
  | { kind: "challan" };

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
  challans,
  defaultPaymentDays,
  blockers = [],
  withholding = false,
  hasMultiples = false,
  kind = "consumables",
  equipmentSubject = "",
  equipmentTerms = null,
}: {
  id: string;
  status: SalesOrderStatus;
  paymentStatus: "unpaid" | "paid";
  leadEmail: string | null;
  proposals: VersionRow[];
  invoices: VersionRow[];
  challans: VersionRow[];
  defaultPaymentDays: number;
  /** Whether AIT has already been recorded, so the menu says update. */
  withholding?: boolean;
  /** True when any line is for more than one, which is when the choice matters. */
  hasMultiples?: boolean;
  /** Reasons the next step cannot run yet; disables the primary action. */
  blockers?: string[];
  /** Equipment orders get the letter's dialog instead of the quantity choice. */
  kind?: SalesOrderKind;
  /** "Quotation for the …", built from the lines on the server. */
  equipmentSubject?: string;
  /** The terms the last equipment proposal went out with, to start from. */
  equipmentTerms?: EquipmentTerms | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });

  // Proposal fields
  const [subject, setSubject] = useState(
    "Proposal for Medical and Surgical Consumables",
  );
  const [intro, setIntro] = useState("");
  // The equipment letter: subject, optional opening, six numbered terms —
  // opening with whatever the last version said, or the standard wording.
  const [eqDraft, setEqDraft] = useState<EquipmentProposalDraft>(() =>
    equipmentProposalDraft(equipmentSubject, equipmentTerms),
  );
  // Invoice fields
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentDays, setPaymentDays] = useState(String(defaultPaymentDays));
  const [dispatchNote, setDispatchNote] = useState("");
  // Payment fields
  const [method, setMethod] = useState<SalesPaymentMethod>("bank");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  // Send fields
  const [to, setTo] = useState(leadEmail ?? "");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [confirmRecipient, setConfirmRecipient] = useState(false);
  // AIT fields. The rate is what a client quotes; the amount is what their
  // deduction slip actually says, and wins when both are given.
  const [aitRate, setAitRate] = useState("5");
  const [aitAmount, setAitAmount] = useState("");
  const [aitCert, setAitCert] = useState(false);
  // A proposal quotes a rate. Only worth asking when a line is for more than
  // one — with everything at qty 1 the two choices print the same paper.
  const [quantityMode, setQuantityMode] = useState<"single" | "ordered">(
    "single",
  );

  /**
   * Actions that read the ORDER'S LINES, so acting on unsaved ones would
   * produce a document, a reservation or a copy from figures nobody has
   * committed. Recording a payment or a withholding does not read them, so
   * those are left alone.
   */
  const READS_LINES = new Set([
    "proposal",
    "invoice",
    "challan",
    "transition",
    "repeat",
  ]);

  async function post(
    body: Record<string, unknown>,
    okMessage: string,
    /** Set by the retry below, which has just saved and must not be stopped
        again by a flag React has not caught up with yet. */
    afterSaving = false,
  ) {
    if (
      !afterSaving &&
      hasUnsavedChanges() &&
      READS_LINES.has(String(body.action))
    ) {
      // The exact trap that lost a cost price in production: the figure is on
      // screen, it is not in the database, and the document would go out
      // without it.
      toast.warning("The items have unsaved changes.", {
        description:
          "Save them first, or this will use the figures already stored.",
        action: {
          label: "Save and continue",
          onClick: async () => {
            await saveUnsavedChanges();
            await post(body, okMessage, true);
          },
        },
      });
      return null;
    }
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
  const unsaved = useUnsavedChanges();
  const primary = nextAction(status, paymentStatus);
  const blocked = blockers.length > 0;
  const otherMoves = next.filter((s) => s !== primary.to);

  function runPrimary() {
    if (blocked) return;
    if (primary.kind === "proposal") return setDialog({ kind: "proposal" });
    if (primary.kind === "invoice") return setDialog({ kind: "invoice" });
    if (primary.kind === "payment") return setDialog({ kind: "payment" });
    if (primary.kind === "transition" && primary.to) {
      const to = primary.to;
      void post(
        { action: "transition", to },
        `Moved to ${SALES_ORDER_STATUS_LABEL[to].toLowerCase()}.`,
      );
    }
  }
  /**
   * Copy this order into a new draft for the same client.
   *
   * Lands the admin on the copy — that is the thing they are about to work
   * on — and says plainly where the catalogue has moved away from the prices
   * being carried over, rather than re-pricing behind their back.
   */
  async function repeat() {
    const data = await post({ action: "repeat" }, "Order copied.");
    if (!data || typeof data !== "object") return;
    const { id: newId, priceChanges } = data as {
      id?: string;
      priceChanges?: {
        description: string;
        wasMinor: number;
        nowMinor: number;
      }[];
    };
    if (priceChanges?.length) {
      toast.warning(
        `Copied at the agreed prices. The catalogue has changed on ${priceChanges.length} line${priceChanges.length === 1 ? "" : "s"}.`,
      );
    }
    if (newId) router.push(`/admin/company/sales/orders/${newId}`);
  }

  const docHref = (kind: string, version: number, download = false) =>
    `/api/admin/company/sales/orders/${id}/documents/${kind}/${version}${download ? "?download=1" : ""}`;

  return (
    <>
      <DetailCard title="Status">
        {unsaved && (
          <p className="text-admin-xs mb-3 rounded-md border border-[color-mix(in_srgb,var(--tone-warning)_var(--tone-edge),transparent)] bg-[color-mix(in_srgb,var(--tone-warning)_var(--tone-fill),transparent)] px-3 py-2 text-[var(--tone-warning-fg)]">
            The items have unsaved changes. Save them before generating a
            document, or it will show the figures already stored.
          </p>
        )}
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
            <DropdownMenuContent align="end" className="w-60">
              {/* Selling the same thing again. Available from any order that
                  has lines, because "they want that again" happens at every
                  stage, including years later. */}
              <DropdownMenuLabel>This order</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void repeat()}>
                <Copy className="size-4" />
                Repeat this order
              </DropdownMenuItem>
              {status === "draft" && (
                <DropdownMenuItem
                  onSelect={() => setDialog({ kind: "invoice" })}
                >
                  <Receipt className="size-4" />
                  Invoice without a proposal
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
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
                  onSelect={() => setDialog({ kind: "challan" })}
                >
                  <Truck className="size-4" />
                  {challans.length > 0
                    ? "Regenerate delivery challan"
                    : "Delivery challan"}
                </DropdownMenuItem>
              )}
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

              {(status === "invoiced" || status === "delivered") && (
                <DropdownMenuItem
                  onSelect={() => setDialog({ kind: "withholding" })}
                >
                  <FileText className="size-4" />
                  {withholding ? "Update AIT withheld" : "Record AIT withheld"}
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
                        // Going BACKWARDS asks first. A misclick here is the
                        // kind that is only noticed later, when the order is
                        // sitting in a stage nobody remembers moving it to.
                        goesBackwards(status, s)
                          ? setDialog({ kind: "revert", to: s })
                          : post(
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
      <DocumentList
        title="Delivery challans"
        kind="challan"
        rows={challans}
        docHref={docHref}
        onSend={(version) => {
          setMailSubject("Delivery challan from Spiber Med Limited");
          setMailBody(
            "Please find the delivery challan for your order attached.",
          );
          setTo(leadEmail ?? "");
          setConfirmRecipient(false);
          setDialog({ kind: "send", docKind: "challan", version });
        }}
      />

      {/* Generate proposal */}
      <Dialog
        open={dialog.kind === "proposal"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate proposal</DialogTitle>
            <DialogDescription>
              A new version is produced and filed in the company documents.
            </DialogDescription>
          </DialogHeader>
          {kind === "equipment" ? (
            <EquipmentProposalFields
              value={eqDraft}
              onChange={setEqDraft}
              idPrefix="p-eq"
            />
          ) : (
            <div className="grid gap-3">
              {hasMultiples && (
                <fieldset className="grid gap-2 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">
                    Quantities on this quotation
                  </legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="qty-mode"
                      className="mt-1"
                      checked={quantityMode === "single"}
                      onChange={() => setQuantityMode("single")}
                    />
                    <span>
                      <strong>Quote per piece</strong>
                      <span className="text-muted-foreground block text-xs">
                        Every line shows a quantity of 1 at its unit rate. The
                        client orders the quantity they want.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="qty-mode"
                      className="mt-1"
                      checked={quantityMode === "ordered"}
                      onChange={() => setQuantityMode("ordered")}
                    />
                    <span>
                      <strong>Show the quantities entered</strong>
                      <span className="text-muted-foreground block text-xs">
                        Prints what is on the order, with each line totalled.
                      </span>
                    </span>
                  </label>
                </fieldset>
              )}
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
              onClick={() =>
                post(
                  kind === "equipment"
                    ? {
                        action: "proposal",
                        subject: eqDraft.subject,
                        intro: eqDraft.intro,
                        equipmentTerms: eqDraft.terms,
                      }
                    : {
                        action: "proposal",
                        subject,
                        intro,
                        quantityMode: hasMultiples ? quantityMode : undefined,
                      },
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

      {/* Record what the buyer withheld */}
      <Dialog
        open={dialog.kind === "withholding"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AIT withheld by the client</DialogTitle>
            <DialogDescription>
              The buyer keeps this back and pays it to the government against
              our income tax. It changes what lands in the bank, not what we
              earned, so it never touches profit — and it comes back when the
              certificate arrives.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ait-rate">Rate (%)</Label>
              <Input
                id="ait-rate"
                value={aitRate}
                onChange={(e) => setAitRate(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-muted-foreground text-xs">
                Applied to the invoice total.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ait-amount">Or the exact amount (৳)</Label>
              <Input
                id="ait-amount"
                value={aitAmount}
                onChange={(e) => setAitAmount(e.target.value)}
                inputMode="decimal"
                placeholder="From their deduction slip"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aitCert}
              onChange={(e) => setAitCert(e.target.checked)}
            />
            The withholding certificate has been received
          </label>
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
                    action: "withholding",
                    aitRateBp: aitAmount.trim()
                      ? undefined
                      : Math.round((Number(aitRate) || 0) * 100),
                    aitMinor: aitAmount.trim()
                      ? Math.round((Number(aitAmount) || 0) * 100)
                      : undefined,
                    certificateReceived: aitCert,
                  },
                  "AIT recorded.",
                )
              }
            >
              Record
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

      {/* Delivery challan */}
      <Dialog
        open={dialog.kind === "challan"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delivery challan</DialogTitle>
            <DialogDescription>
              The note that travels with the goods. It lists quantities only —
              no prices — and is signed for on delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="c-dispatch">Dispatch note (optional)</Label>
            <Input
              id="c-dispatch"
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
              maxLength={300}
              placeholder="Vehicle, driver or courier"
            />
            <p className="text-muted-foreground text-admin-xs">
              {challans.length > 0
                ? "Regenerating replaces the current challan and keeps the same number."
                : "Takes the next number in the challan series."}
            </p>
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
                    action: "challan",
                    dispatchNote: dispatchNote.trim() || undefined,
                  },
                  "Delivery challan generated.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moving an order back down the pipeline */}
      <Dialog
        open={dialog.kind === "revert"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              Move back to{" "}
              {dialog.kind === "revert"
                ? SALES_ORDER_STATUS_LABEL[dialog.to].toLowerCase()
                : ""}
              ?
            </DialogTitle>
            <DialogDescription>
              {dialog.kind === "revert" && dialog.to === "draft"
                ? "The order goes back to being edited. Any proposal already sent stays on file, and the client still holds their copy."
                : "This undoes the step the order is on. Anything already sent to the client stays on file."}
              {status === "invoiced" &&
                " Leaving the invoiced stage also releases the stock this order was holding."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
            >
              Keep it where it is
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (dialog.kind !== "revert") return;
                const to = dialog.to;
                void post(
                  { action: "transition", to },
                  `Moved to ${SALES_ORDER_STATUS_LABEL[to].toLowerCase()}.`,
                );
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Move back
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
  kind: DocKind;
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
                {!v.superseded && v.stale && (
                  <span className="ml-2 text-xs text-[var(--tone-warning-fg)]">
                    does not match the order
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                {new Date(v.generatedAt).toLocaleString()}
                {v.emailedAt
                  ? ` · sent to ${v.emailedTo.join(",")}`
                  : " · not sent"}
                {v.templateVersion != null &&
                  ` · layout ${v.templateVersion === 0 ? "built-in" : `v${v.templateVersion}`}`}
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
