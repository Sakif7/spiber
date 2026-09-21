"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSection, FormField } from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import { formatApiError } from "@/lib/http/form-error";
import { priceSalesOrder } from "@/lib/schemas/sales-order";
import { blockers } from "@/lib/sales/journey";
import {
  equipmentSummary,
  SALES_ORDER_KIND_LABEL,
  type SalesOrderKind,
} from "@/lib/sales/equipment";
import { cn } from "@/lib/cn";
import {
  EquipmentProposalFields,
  equipmentProposalDraft,
  type EquipmentProposalDraft,
} from "./equipment-proposal-fields";

/** A line as the editor holds it; prices are entered in taka, stored in poisha. */
export type EditorLine = {
  id?: string;
  kind: "inventory" | "external";
  productId?: string | null;
  variantId?: string | null;
  sku?: string | null;
  description: string;
  brandOrigin: string;
  specification: string;
  /** Equipment lines: shown instead of Brand/Origin and Unit. */
  model: string;
  manufacturer: string;
  origin: string;
  /** Known once the machine is on the floor; printed on the challan only. */
  serialNo: string;
  unit: string;
  /** Taka, as typed. */
  unitPrice: string;
  /**
   * What the line costs US, in taka as typed.
   *
   * Prefilled from the catalogue when a product is picked, and free to type on
   * an external item that was bought in for this order. Always editable: the
   * price actually paid to a supplier is not always the price on the product.
   */
  unitCost: string;
  /**
   * VAT for this line, as typed — a percentage or a taka figure, per
   * `vatMode`. Blank means "not set on this line".
   *
   * Setting it on ANY line takes the whole order out of the configured rate
   * and onto per-line VAT, at which point a blank line carries none. The
   * editor says so where it can be read.
   */
  vatValue: string;
  vatMode: "percent" | "amount";
  qty: string;
  /** What inventory says is still available, for a visible warning. */
  available?: number | null;
};

/** What a line contributes to pricing, from what was typed into it. */
function vatOf(l: EditorLine): {
  vatRateBp?: number | null;
  vatAmountMinor?: number | null;
} {
  const raw = l.vatValue.trim();
  if (raw === "") return {};
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return {};
  return l.vatMode === "percent"
    ? { vatRateBp: Math.round(n * 100) }
    : { vatAmountMinor: Math.round(n * 100) };
}

type ProductHit = {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  sku: string;
  priceMinor: number | null;
  costPriceMinor: number | null;
  onHand: number;
  reserved: number;
  available: number;
  tracked: boolean;
  /** Prefill for the printed columns, resolved server-side from the catalogue. */
  description: string;
  specification: string;
  brandOrigin: string;
  /** The two halves of Brand/Origin, for an equipment line's own fields. */
  brand?: string;
  origin?: string;
};

const toMinor = (taka: string) => Math.round((Number(taka) || 0) * 100);
const fromMinor = (minor: number | null | undefined) =>
  minor == null ? "" : String(minor / 100);
const money = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

const emptyExternal = (orderKind: SalesOrderKind): EditorLine => ({
  kind: "external",
  description: "",
  brandOrigin: "",
  specification: "",
  model: "",
  manufacturer: "",
  origin: "",
  serialNo: "",
  // A machine is counted in units; the challan prints the word.
  unit: orderKind === "equipment" ? "unit" : "",
  unitPrice: "",
  unitCost: "",
  vatValue: "",
  vatMode: "percent",
  qty: "1",
});

/**
 * The order builder.
 *
 * Two kinds of line: catalogue products, which move real stock and show what is
 * still available, and free-text externals bought in for this order only. The
 * distinction is what keeps a one-off purchase out of the inventory ledger.
 */
export function OrderEditor({
  orderId,
  leadId,
  initialKind = "consumables",
  kindLocked = false,
  initialLines,
  initialDiscount,
  initialDelivery = 0,
  initialReferenceNo = "",
  initialVatRateBp,
  initialAitRateBp = 0,
  canEdit,
}: {
  orderId?: string;
  leadId?: string;
  /** Consumables or equipment — which paper the order produces. */
  initialKind?: SalesOrderKind;
  /** True once a document exists or the order has left Draft: the kind stays. */
  kindLocked?: boolean;
  initialLines: EditorLine[];
  initialDiscount: number;
  /** Transport / delivery charged on top; printed as its own invoice row. */
  initialDelivery?: number;
  /** The client's own purchase-order reference. */
  initialReferenceNo?: string;
  initialVatRateBp: number;
  /** Expected withholding. Printed on the invoice; never added to the total. */
  initialAitRateBp?: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<SalesOrderKind>(initialKind);
  const equipment = kind === "equipment";
  const [lines, setLines] = useState<EditorLine[]>(initialLines);
  const [discount, setDiscount] = useState(fromMinor(initialDiscount));
  const [delivery, setDelivery] = useState(fromMinor(initialDelivery));
  const [referenceNo, setReferenceNo] = useState(initialReferenceNo);
  // The order-level rate comes from settings and is shown, not edited: VAT is
  // now either that rate on the whole invoice, or set line by line.
  const vatRateBp = initialVatRateBp;
  const [aitPercent, setAitPercent] = useState(String(initialAitRateBp / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Asked just before the proposal is produced, and only when it changes what
  // the paper says — everything at qty 1 prints identically either way.
  const [askQty, setAskQty] = useState(false);
  const hasMultiples = lines.some((l) => (Number(l.qty) || 0) > 1);
  // An equipment letter's terms are checked before it goes out. Prepared
  // from the lines when the dialog opens: the subject names the machines.
  const [askTerms, setAskTerms] = useState<EquipmentProposalDraft | null>(null);

  const totals = useMemo(
    () =>
      priceSalesOrder({
        items: lines.map((l) => ({
          unitPriceMinor: toMinor(l.unitPrice),
          qty: Number(l.qty) || 0,
          ...vatOf(l),
        })),
        discountMinor: toMinor(discount),
        deliveryMinor: toMinor(delivery),
        vatRateBp,
      }),
    [lines, discount, delivery, vatRateBp],
  );

  /**
   * The same checks the stage rail runs, applied as you type — so the editor
   * will not save an order the very next step would refuse.
   */
  const problems = useMemo(
    () =>
      blockers(
        "draft",
        lines.map((l) => ({
          description: l.description,
          unitPriceMinor: toMinor(l.unitPrice),
          qty: Number(l.qty) || 0,
        })),
      ),
    [lines],
  );
  const ready = problems.length === 0;

  /** Per-row flags, so an error shows on the line that has it. */
  const rowIssue = (l: EditorLine) => ({
    description: !l.description.trim(),
    price: toMinor(l.unitPrice) <= 0,
    qty: (Number(l.qty) || 0) <= 0,
  });

  const setLine = (i: number, patch: Partial<EditorLine>) =>
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  const addProduct = (hit: ProductHit) =>
    setLines((prev) => [
      ...prev,
      {
        kind: "inventory",
        productId: hit.productId,
        variantId: hit.variantId,
        sku: hit.sku,
        // All three come from the catalogue and stay editable. They were
        // previously derived from the picker row alone, which is why Brand/Origin
        // printed blank and Specification only ever held a variant label.
        description: hit.variantLabel
          ? `${hit.description} · ${hit.variantLabel}`
          : hit.description,
        brandOrigin: hit.brandOrigin,
        specification: hit.variantLabel
          ? `${hit.specification} · ${hit.variantLabel}`
          : hit.specification,
        // The catalogue's brand is the machine's maker; the model and the
        // serial number are typed, since the catalogue knows neither.
        model: "",
        manufacturer: hit.brand ?? "",
        origin: hit.origin ?? "",
        serialNo: "",
        unit: equipment ? "unit" : "pcs",
        unitPrice: fromMinor(hit.priceMinor),
        unitCost: fromMinor(hit.costPriceMinor),
        vatValue: "",
        vatMode: "percent",
        qty: "1",
        available: hit.tracked ? hit.available : null,
      },
    ]);

  /**
   * The order exactly as a save would send it.
   *
   * Shared by the save itself and by the unsaved-changes check, so the two can
   * never disagree about what counts as an edit — and so a difference of
   * FORMATTING ("60" against "60.00") is not mistaken for one, since both
   * sides are compared after conversion to poisha.
   */
  function buildPayload() {
    return {
      kind,
      items: lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        productId: l.productId ?? undefined,
        variantId: l.variantId ?? undefined,
        sku: l.sku ?? undefined,
        description: l.description,
        brandOrigin: l.brandOrigin,
        specification: l.specification,
        model: l.model,
        manufacturer: l.manufacturer,
        origin: l.origin,
        serialNo: l.serialNo,
        unit: l.unit,
        unitPriceMinor: toMinor(l.unitPrice),
        // Blank means nobody has said what it cost, which the report shows
        // as a gap rather than as a 100% margin.
        unitCostMinor: l.unitCost.trim() ? toMinor(l.unitCost) : null,
        // Null, not omitted: an amend has to be able to CLEAR a line's VAT,
        // and the service reads undefined as "no opinion".
        vatRateBp: vatOf(l).vatRateBp ?? null,
        vatAmountMinor: vatOf(l).vatAmountMinor ?? null,
        qty: Number(l.qty) || 1,
      })),
      discountMinor: toMinor(discount),
      deliveryMinor: toMinor(delivery),
      referenceNo,
      // Not editable here — it is the configured rate, carried through
      // unchanged so an amend cannot silently re-rate the order.
      vatRateBp,
      aitRateBp: Math.round((Number(aitPercent) || 0) * 100),
    };
  }

  /**
   * Is there anything typed here that the database does not have?
   *
   * Compared against the props the server just rendered, so a successful save
   * clears it by itself: the save refreshes the page, the props come back with
   * the new figures, and the two sides match again.
   */
  const dirty =
    JSON.stringify(buildPayload()) !==
    JSON.stringify({
      kind: initialKind,
      items: initialLines.map((l) => ({
        id: l.id,
        kind: l.kind,
        productId: l.productId ?? undefined,
        variantId: l.variantId ?? undefined,
        sku: l.sku ?? undefined,
        description: l.description,
        brandOrigin: l.brandOrigin,
        specification: l.specification,
        model: l.model,
        manufacturer: l.manufacturer,
        origin: l.origin,
        serialNo: l.serialNo,
        unit: l.unit,
        unitPriceMinor: toMinor(l.unitPrice),
        unitCostMinor: l.unitCost.trim() ? toMinor(l.unitCost) : null,
        vatRateBp: vatOf(l).vatRateBp ?? null,
        vatAmountMinor: vatOf(l).vatAmountMinor ?? null,
        qty: Number(l.qty) || 1,
      })),
      discountMinor: initialDiscount,
      deliveryMinor: initialDelivery,
      referenceNo: initialReferenceNo,
      vatRateBp: initialVatRateBp,
      aitRateBp: initialAitRateBp,
    });

  // Publishes to the panels beside this one, and guards a browser reload.
  useUnsavedGuard(dirty && Boolean(orderId), () => save());

  /**
   * Save, and optionally produce the proposal in the same click.
   *
   * Creating an order used to be: fill this in, save, land on the order, find
   * the generate action, fill that dialog. For a new order the proposal is
   * almost always the next thing, so it is offered here as one step.
   */
  async function save(
    thenGenerateProposal = false,
    quantityMode: "single" | "ordered" = "ordered",
    proposal?: EquipmentProposalDraft,
  ) {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();

      const res = await fetch(
        orderId
          ? `/api/admin/company/sales/orders/${orderId}`
          : "/api/admin/company/sales/orders",
        {
          method: orderId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderId ? payload : { leadId, ...payload }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the order."));
        return;
      }
      const savedId = orderId ?? json?.data?.id ?? "";
      toast.success(orderId ? "Order updated." : "Order created.");

      if (thenGenerateProposal && savedId) {
        const gen = await fetch(`/api/admin/company/sales/orders/${savedId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            proposal
              ? {
                  action: "proposal",
                  subject: proposal.subject,
                  intro: proposal.intro,
                  equipmentTerms: proposal.terms,
                }
              : { action: "proposal", quantityMode },
          ),
        });
        if (gen.ok) {
          toast.success("Proposal generated.");
        } else {
          // The order is saved either way; say what did not happen rather than
          // rolling the save back.
          const g = await gen.json().catch(() => null);
          toast.error(
            formatApiError(
              g,
              "Order saved, but the proposal did not generate.",
            ),
          );
        }
      }

      if (orderId) {
        // Already on this order's page. Pushing the URL we are on races the
        // refresh and can leave the panels beside the editor showing the
        // figures from before the save — which reads as "the amendment did
        // not work" even though it did.
        router.refresh();
      } else {
        router.push(`/admin/company/sales/orders/${savedId}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <FormSection
        title="Items"
        action={
          canEdit ? (
            <div className="flex gap-1.5">
              <ProductPicker onPick={addProduct} />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setLines((p) => [...p, emptyExternal(kind)])}
              >
                <Plus className="size-4" />
                External item
              </Button>
            </div>
          ) : undefined
        }
      >
        {/* Which paper this order produces. Fixed once a document exists:
            a quotation already sent as a letter cannot become a table. */}
        <div className="mb-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <FormField
            label="Order type"
            hint={
              kindLocked
                ? "Fixed once a document has been generated."
                : equipment
                  ? "A letter naming the equipment, one price in words, the manufacturer in the terms."
                  : "A quotation and invoice with a table of lines."
            }
          >
            <SelectField
              id="order-kind"
              ariaLabel="Order type"
              value={kind}
              onChange={(v) => setKind(v as SalesOrderKind)}
              disabled={!canEdit || kindLocked}
              options={(
                Object.keys(SALES_ORDER_KIND_LABEL) as SalesOrderKind[]
              ).map((k) => ({ value: k, label: SALES_ORDER_KIND_LABEL[k] }))}
            />
          </FormField>
        </div>
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {equipment
              ? "No equipment yet. Add a machine from inventory, or an external item that is bought in for this order."
              : "No items yet. Add products from inventory, or an external item that is bought in for this order."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead>
                {/* The three text columns used to be sized as percentages of
                    the table — 34/14/22 — which left the seven numeric ones to
                    share whatever was left. In the sidebar layout that was
                    about 240px for 568px of intent, so the browser crushed
                    them and a cost of 138,000 rendered as "13".

                    The numbers now have real widths that cannot be taken from
                    them, the text columns share what remains, and the whole
                    table has a min-width so it scrolls rather than compresses
                    on a narrow screen. */}
                <tr className="text-muted-foreground border-b text-left">
                  <th className="w-8 py-2">#</th>
                  {equipment ? (
                    <>
                      {/* A machine is named, modelled and made somewhere;
                          brand/origin and a unit column say nothing here. */}
                      <th className="w-[18%] py-2">Equipment</th>
                      <th className="w-[10%] py-2">Model</th>
                      <th className="w-[12%] py-2">Manufacturer</th>
                      <th className="w-[8%] py-2">Origin</th>
                      <th className="w-[14%] py-2">Specification</th>
                      <th className="w-[10%] py-2">Serial no</th>
                    </>
                  ) : (
                    <>
                      <th className="w-[26%] py-2">Description</th>
                      <th className="w-[13%] py-2">Brand/Origin</th>
                      <th className="w-[19%] py-2">Specification</th>
                      <th className="w-16 py-2">Unit</th>
                    </>
                  )}
                  {/* pr-5 = the cell's pr-2 plus the input's own 12px of
                      padding; without it the heading floats right of its
                      figures. VAT needs the width of its unit toggle too. */}
                  <th className="w-24 py-2 pr-5 text-right">Unit cost</th>
                  <th className="w-24 py-2 pr-5 text-right">Unit price</th>
                  <th className="w-36 py-2 pr-14 text-right">VAT</th>
                  <th className="w-16 py-2 pr-5 text-right">Qty</th>
                  <th className="w-28 py-2 text-right">Total</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const lineTotal = toMinor(l.unitPrice) * (Number(l.qty) || 0);
                  const short =
                    l.available != null && Number(l.qty) > l.available;
                  // Flag the field that is wrong, on the row that is wrong,
                  // rather than one message at the bottom of the form.
                  const issue = rowIssue(l);
                  return (
                    <tr key={l.id ?? i} className="border-b align-top">
                      <td className="text-muted-foreground py-2">{i + 1}</td>
                      <td className="py-1 pr-2">
                        <Input
                          value={l.description}
                          onChange={(e) =>
                            setLine(i, { description: e.target.value })
                          }
                          disabled={!canEdit}
                          aria-invalid={issue.description}
                          className={cn(
                            "h-8",
                            issue.description && "border-destructive",
                          )}
                        />
                        {issue.description && (
                          <span className="text-destructive text-admin-2xs block">
                            Needs a description
                          </span>
                        )}
                        {l.kind === "external" && (
                          <span className="text-muted-foreground text-admin-2xs">
                            External — not from inventory
                          </span>
                        )}
                        {short && (
                          <span className="text-destructive text-admin-2xs block">
                            Only {l.available} available
                          </span>
                        )}
                      </td>
                      {equipment ? (
                        <>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.model}
                              onChange={(e) =>
                                setLine(i, { model: e.target.value })
                              }
                              disabled={!canEdit}
                              aria-label={`Model for line ${i + 1}`}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.manufacturer}
                              onChange={(e) =>
                                setLine(i, { manufacturer: e.target.value })
                              }
                              disabled={!canEdit}
                              aria-label={`Manufacturer for line ${i + 1}`}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.origin}
                              onChange={(e) =>
                                setLine(i, { origin: e.target.value })
                              }
                              disabled={!canEdit}
                              aria-label={`Country of origin for line ${i + 1}`}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.specification}
                              onChange={(e) =>
                                setLine(i, { specification: e.target.value })
                              }
                              disabled={!canEdit}
                              aria-label={`Specification for line ${i + 1}`}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.serialNo}
                              onChange={(e) =>
                                setLine(i, { serialNo: e.target.value })
                              }
                              disabled={!canEdit}
                              aria-label={`Serial number for line ${i + 1}`}
                              placeholder="At delivery"
                              className="h-8"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.brandOrigin}
                              onChange={(e) =>
                                setLine(i, { brandOrigin: e.target.value })
                              }
                              disabled={!canEdit}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.specification}
                              onChange={(e) =>
                                setLine(i, { specification: e.target.value })
                              }
                              disabled={!canEdit}
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={l.unit}
                              onChange={(e) =>
                                setLine(i, { unit: e.target.value })
                              }
                              disabled={!canEdit}
                              className="h-8"
                            />
                          </td>
                        </>
                      )}
                      <td className="py-1 pr-2">
                        <Input
                          value={l.unitCost}
                          onChange={(e) =>
                            setLine(i, { unitCost: e.target.value })
                          }
                          disabled={!canEdit}
                          inputMode="decimal"
                          placeholder="—"
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={l.unitPrice}
                          onChange={(e) =>
                            setLine(i, { unitPrice: e.target.value })
                          }
                          disabled={!canEdit}
                          inputMode="decimal"
                          aria-invalid={issue.price}
                          className={cn(
                            "h-8 text-right",
                            issue.price && "border-destructive",
                          )}
                        />
                        {issue.price && (
                          <span className="text-destructive text-admin-2xs block">
                            Needs a price
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <div className="flex items-center gap-1">
                          <Input
                            value={l.vatValue}
                            onChange={(e) =>
                              setLine(i, { vatValue: e.target.value })
                            }
                            disabled={!canEdit}
                            inputMode="decimal"
                            placeholder="—"
                            aria-label={`VAT for line ${i + 1}`}
                            className="h-8 text-right"
                          />
                          {/* One box, two meanings. A separate column for each
                              would be two mostly-empty columns, and the client
                              enters VAT one way or the other, never both. */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit}
                            aria-label={
                              l.vatMode === "percent"
                                ? "VAT entered as a percentage; switch to an amount"
                                : "VAT entered as an amount; switch to a percentage"
                            }
                            className="h-8 w-8 shrink-0 px-0 font-mono"
                            onClick={() =>
                              setLine(i, {
                                vatMode:
                                  l.vatMode === "percent"
                                    ? "amount"
                                    : "percent",
                              })
                            }
                          >
                            {l.vatMode === "percent" ? "%" : "৳"}
                          </Button>
                        </div>
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={l.qty}
                          onChange={(e) => setLine(i, { qty: e.target.value })}
                          disabled={!canEdit}
                          inputMode="numeric"
                          aria-invalid={issue.qty || short}
                          className={cn(
                            "h-8 text-right",
                            (short || issue.qty) && "border-destructive",
                          )}
                        />
                      </td>
                      <td className="py-2 text-right font-medium">
                        {money(lineTotal)}
                      </td>
                      <td className="py-1 text-right">
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive size-8"
                            aria-label="Remove line"
                            onClick={() =>
                              setLines((p) => p.filter((_, n) => n !== i))
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection title="Totals">
        {/* Four fields on ONE grid, so the column edges line up down the whole
            block. They used to be two stacked grids — `sm:grid-cols-2` above
            `sm:grid-cols-[1fr_1fr_auto]` — which silently gave the two rows
            different column widths: Discount ended ~50px short of Reference,
            and VAT started ~65px left of Transport. Every field also carries a
            hint now, so no cell is a line shorter than the one beside it. */}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <FormField
            label="Reference / PO No."
            hint="Optional. Shown on the invoice."
          >
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              disabled={!canEdit}
              placeholder="Their purchase-order number"
            />
          </FormField>
          <FormField
            label="Transport / delivery (৳)"
            hint="Billed on top. VAT is never charged on it."
          >
            <Input
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              disabled={!canEdit}
              inputMode="decimal"
            />
          </FormField>
          <FormField label="Discount (৳)" hint="Taken off before VAT.">
            <Input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={!canEdit}
              inputMode="decimal"
            />
          </FormField>
          <FormField
            label="AIT (%)"
            hint="What the client withholds. Printed on the invoice; never added to the total."
          >
            <Input
              value={aitPercent}
              onChange={(e) => setAitPercent(e.target.value)}
              disabled={!canEdit}
              inputMode="decimal"
            />
          </FormField>
        </div>

        {/* The running total is its own thing, not a fourth column wedged into
            the field grid with no heading. Every row is labelled — including
            the total, which previously printed as a bare number. */}
        <dl className="border-border bg-muted/40 mt-4 ml-auto w-full max-w-xs space-y-1.5 rounded-md border p-3">
          <TotalRow label="Subtotal" value={money(totals.subtotalMinor)} />
          {totals.discountMinor > 0 && (
            <TotalRow
              label="Discount"
              value={`−${money(totals.discountMinor)}`}
            />
          )}
          {totals.vatMinor > 0 && (
            <TotalRow
              label={
                totals.perLineVat
                  ? "VAT (per line)"
                  : `VAT (${vatRateBp / 100}%)`
              }
              value={money(totals.vatMinor)}
            />
          )}
          {totals.deliveryMinor > 0 && (
            <TotalRow label="Transport" value={money(totals.deliveryMinor)} />
          )}
          <div className="border-border mt-1.5 border-t pt-1.5">
            <TotalRow label="Total" value={money(totals.totalMinor)} emphasis />
          </div>
        </dl>
      </FormSection>

      {canEdit && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {/* On a NEW order the proposal is nearly always the next thing, so
                it is the primary button and saves a whole round trip. */}
            {orderId ? (
              <>
                <Button onClick={() => save()} disabled={saving || !ready}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
                {/* Typed figures live in the browser until this button is
                    pressed, and everything else on the page leaves them
                    looking saved. Say so, right beside the button that fixes
                    it. */}
                {dirty && (
                  <span className="text-admin-xs inline-flex items-center gap-1.5 font-medium text-[var(--tone-warning-fg)]">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Unsaved changes
                  </span>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={() => {
                    if (equipment) {
                      setAskTerms(
                        equipmentProposalDraft(
                          `Quotation for the ${equipmentSummary(
                            lines.map((l) => ({
                              description: l.description,
                              model: l.model,
                              qty: Number(l.qty) || 1,
                            })),
                          )}`,
                        ),
                      );
                    } else if (hasMultiples) {
                      setAskQty(true);
                    } else {
                      void save(true);
                    }
                  }}
                  disabled={saving || !ready}
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Create and generate proposal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => save()}
                  disabled={saving || !ready}
                >
                  Save as draft
                </Button>
              </>
            )}
            {error && <p className="text-destructive">{error}</p>}
          </div>
          {problems.length > 0 && (
            <p className="text-muted-foreground text-xs">{problems.join("")}</p>
          )}
        </div>
      )}

      {/* The equipment letter's subject and terms, checked before the first
          version goes out. Saved and generated in one go, like the button
          says. */}
      <Dialog
        open={askTerms !== null}
        onOpenChange={(o) => !o && setAskTerms(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate the equipment proposal</DialogTitle>
            <DialogDescription>
              The order is created first, then the letter is produced and filed
              in the company documents.
            </DialogDescription>
          </DialogHeader>
          {askTerms && (
            <EquipmentProposalFields
              value={askTerms}
              onChange={setAskTerms}
              idPrefix="new-eq"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAskTerms(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || !askTerms}
              onClick={() => {
                const draft = askTerms;
                if (!draft) return;
                setAskTerms(null);
                void save(true, "ordered", draft);
              }}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create and generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* A proposal quotes a rate, so the usual thing to send is a per-piece
          price — but the order may have been drafted with real quantities.
          Only asked when the two would print differently. */}
      <Dialog open={askQty} onOpenChange={setAskQty}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How should quantities appear?</DialogTitle>
            <DialogDescription>
              Some lines are for more than one. This changes the quotation only
              — the order keeps the quantities you entered.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              disabled={saving}
              onClick={() => {
                setAskQty(false);
                void save(true, "single");
              }}
            >
              <span>
                <strong className="block">Quote per piece</strong>
                <span className="text-muted-foreground text-xs">
                  Every line shows a quantity of 1 at its unit rate.
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              disabled={saving}
              onClick={() => {
                setAskQty(false);
                void save(true, "ordered");
              }}
            >
              <span>
                <strong className="block">Show the quantities entered</strong>
                <span className="text-muted-foreground text-xs">
                  Prints what is on the order, with each line totalled.
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Search the catalogue and add a product as a line. */
function ProductPicker({ onPick }: { onPick: (hit: ProductHit) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(value: string) {
    setQ(value);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/company/sales/products?q=${encodeURIComponent(value)}`,
      );
      const json = await res.json().catch(() => null);
      if (res.ok) setHits(json?.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && hits.length === 0) void search("");
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add product
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align="end">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => void search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !hits[0]) return;
              e.preventDefault();
              onPick(hits[0]);
              setQ("");
              void search("");
            }}
            placeholder="Search by name or SKU…"
            className="h-8 pl-8"
            autoFocus
          />
        </div>
        <p className="text-muted-foreground text-admin-2xs mt-1.5">
          Press Enter to add the first match. The list stays open so you can add
          several.
        </p>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {loading && hits.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">
              No products match.
            </p>
          ) : (
            hits.map((h) => (
              <button
                key={`${h.productId}:${h.variantId ?? ""}`}
                type="button"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  void search("");
                }}
                className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {h.name}
                    {h.variantLabel ? ` · ${h.variantLabel}` : ""}
                  </span>
                  <span className="text-muted-foreground text-admin-2xs block font-mono">
                    {h.sku}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block">
                    {h.priceMinor == null ? "—" : money(h.priceMinor)}
                  </span>
                  <span
                    className={cn(
                      "text-admin-2xs block",
                      h.tracked && h.available <= 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {h.tracked ? `${h.available} available` : "not tracked"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One line of the totals summary: label left, figure right, digits aligned. */
function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={emphasis ? "font-medium" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "text-base font-semibold tabular-nums"
            : "text-muted-foreground tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
