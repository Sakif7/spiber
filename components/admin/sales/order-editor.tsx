"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2, Loader2 } from "lucide-react";
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
import { formatApiError } from "@/lib/http/form-error";
import { priceSalesOrder } from "@/lib/schemas/sales-order";
import { blockers } from "@/lib/sales/journey";
import { cn } from "@/lib/cn";

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
  qty: string;
  /** What inventory says is still available, for a visible warning. */
  available?: number | null;
};

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
};

const toMinor = (taka: string) => Math.round((Number(taka) || 0) * 100);
const fromMinor = (minor: number | null | undefined) =>
  minor == null ? "" : String(minor / 100);
const money = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

const emptyExternal = (): EditorLine => ({
  kind: "external",
  description: "",
  brandOrigin: "",
  specification: "",
  unit: "",
  unitPrice: "",
  unitCost: "",
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
  initialLines,
  initialDiscount,
  initialDelivery = 0,
  initialReferenceNo = "",
  initialVatRateBp,
  canEdit,
}: {
  orderId?: string;
  leadId?: string;
  initialLines: EditorLine[];
  initialDiscount: number;
  /** Transport / delivery charged on top; printed as its own invoice row. */
  initialDelivery?: number;
  /** The client's own purchase-order reference. */
  initialReferenceNo?: string;
  initialVatRateBp: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<EditorLine[]>(initialLines);
  const [discount, setDiscount] = useState(fromMinor(initialDiscount));
  const [delivery, setDelivery] = useState(fromMinor(initialDelivery));
  const [referenceNo, setReferenceNo] = useState(initialReferenceNo);
  const [vatPercent, setVatPercent] = useState(String(initialVatRateBp / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Asked just before the proposal is produced, and only when it changes what
  // the paper says — everything at qty 1 prints identically either way.
  const [askQty, setAskQty] = useState(false);
  const hasMultiples = lines.some((l) => (Number(l.qty) || 0) > 1);

  const totals = useMemo(
    () =>
      priceSalesOrder({
        items: lines.map((l) => ({
          unitPriceMinor: toMinor(l.unitPrice),
          qty: Number(l.qty) || 0,
        })),
        discountMinor: toMinor(discount),
        deliveryMinor: toMinor(delivery),
        vatRateBp: Math.round((Number(vatPercent) || 0) * 100),
      }),
    [lines, discount, delivery, vatPercent],
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
        unit: "pcs",
        unitPrice: fromMinor(hit.priceMinor),
        unitCost: fromMinor(hit.costPriceMinor),
        qty: "1",
        available: hit.tracked ? hit.available : null,
      },
    ]);

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
  ) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        items: lines.map((l) => ({
          id: l.id,
          kind: l.kind,
          productId: l.productId ?? undefined,
          variantId: l.variantId ?? undefined,
          sku: l.sku ?? undefined,
          description: l.description,
          brandOrigin: l.brandOrigin,
          specification: l.specification,
          unit: l.unit,
          unitPriceMinor: toMinor(l.unitPrice),
          // Blank means nobody has said what it cost, which the report shows
          // as a gap rather than as a 100% margin.
          unitCostMinor: l.unitCost.trim() ? toMinor(l.unitCost) : null,
          qty: Number(l.qty) || 1,
        })),
        discountMinor: toMinor(discount),
        deliveryMinor: toMinor(delivery),
        referenceNo,
        vatRateBp: Math.round((Number(vatPercent) || 0) * 100),
      };

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
          body: JSON.stringify({ action: "proposal", quantityMode }),
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

      router.push(`/admin/company/sales/orders/${savedId}`);
      router.refresh();
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
                onClick={() => setLines((p) => [...p, emptyExternal()])}
              >
                <Plus className="size-4" />
                External item
              </Button>
            </div>
          ) : undefined
        }
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No items yet. Add products from inventory, or an external item that
            is bought in for this order.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
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
                  <th className="w-[26%] py-2">Description</th>
                  <th className="w-[13%] py-2">Brand/Origin</th>
                  <th className="w-[19%] py-2">Specification</th>
                  <th className="w-16 py-2">Unit</th>
                  <th className="w-24 py-2 text-right">Unit cost</th>
                  <th className="w-24 py-2 text-right">Unit price</th>
                  <th className="w-16 py-2 text-right">Qty</th>
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
                          onChange={(e) => setLine(i, { unit: e.target.value })}
                          disabled={!canEdit}
                          className="h-8"
                        />
                      </td>
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
          <FormField label="VAT (%)" hint="0 leaves VAT off the invoice.">
            <Input
              value={vatPercent}
              onChange={(e) => setVatPercent(e.target.value)}
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
              label={`VAT (${vatPercent || 0}%)`}
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
              <Button onClick={() => save()} disabled={saving || !ready}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            ) : (
              <>
                <Button
                  onClick={() =>
                    hasMultiples ? setAskQty(true) : void save(true)
                  }
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
