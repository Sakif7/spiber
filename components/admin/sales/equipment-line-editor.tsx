"use client";

import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormGrid } from "@/components/admin/ui/form-shell";
import { cn } from "@/lib/cn";
import { ProductPicker, type ProductHit } from "./product-picker";
import { emptyExternal, money, toMinor, type EditorLine } from "./editor-line";

/**
 * The equipment order's line editor: ONE machine, its accessories under it.
 *
 * A price offer is a letter about a single set, so the machine is a form
 * rather than a row in a nine-column table — there is only ever one of it,
 * and the fields that matter (model, manufacturer, country of origin) are
 * the ones a reader of the offer looks for.
 *
 * The accessories beneath are ordinary order lines: they may be picked from
 * the catalogue, they reserve and write off stock like anything else, and
 * their price is optional because the usual offer quotes one figure for the
 * whole set.
 */

/** A catalogue pick, as an equipment line. */
export function lineFromProduct(
  hit: ProductHit,
  role: "machine" | "accessory",
): EditorLine {
  return {
    ...emptyExternal("equipment", role),
    kind: "inventory",
    productId: hit.productId,
    variantId: hit.variantId,
    sku: hit.sku,
    description: hit.variantLabel
      ? `${hit.description} · ${hit.variantLabel}`
      : hit.description,
    brandOrigin: hit.brandOrigin,
    specification: hit.variantLabel
      ? `${hit.specification} · ${hit.variantLabel}`
      : hit.specification,
    // The catalogue's brand is the machine's maker; the model and the serial
    // number are typed, since the catalogue knows neither.
    manufacturer: hit.brand ?? "",
    origin: hit.origin ?? "",
    unitPrice: hit.priceMinor == null ? "" : String(hit.priceMinor / 100),
    unitCost:
      hit.costPriceMinor == null ? "" : String(hit.costPriceMinor / 100),
    available: hit.tracked ? hit.available : null,
  };
}

export function EquipmentLineEditor({
  machine,
  accessories,
  canEdit,
  onMachine,
  onAddMachine,
  onRemoveMachine,
  onAccessory,
  onAddAccessory,
  onRemoveAccessory,
}: {
  machine?: EditorLine;
  accessories: EditorLine[];
  canEdit: boolean;
  onMachine: (patch: Partial<EditorLine>) => void;
  onAddMachine: (line: EditorLine) => void;
  onRemoveMachine: () => void;
  onAccessory: (index: number, patch: Partial<EditorLine>) => void;
  onAddAccessory: (line: EditorLine) => void;
  onRemoveAccessory: (index: number) => void;
}) {
  if (!machine) {
    return (
      <div className="grid gap-3">
        <p className="text-muted-foreground text-sm">
          No equipment yet. A price offer covers one machine — add it from
          inventory, or as an external item bought in for this order.
        </p>
        {canEdit && (
          <div className="flex gap-1.5">
            <ProductPicker
              align="start"
              label="Add from inventory"
              onPick={(hit) => onAddMachine(lineFromProduct(hit, "machine"))}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                onAddMachine(emptyExternal("equipment", "machine"))
              }
            >
              <Plus className="size-4" />
              External item
            </Button>
          </div>
        )}
      </div>
    );
  }

  const machineShort =
    machine.available != null && Number(machine.qty) > machine.available;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <FormGrid>
          <FormField
            label="Equipment"
            hint="Printed in the opening sentence and as the table's first row."
          >
            <Input
              value={machine.description}
              onChange={(e) => onMachine({ description: e.target.value })}
              disabled={!canEdit}
              aria-invalid={!machine.description.trim()}
              className={cn(
                !machine.description.trim() && "border-destructive",
              )}
              placeholder="Colour Doppler Ultrasound System"
            />
          </FormField>
          <FormField label="Model" hint="Printed after the name, in brackets.">
            <Input
              value={machine.model}
              onChange={(e) => onMachine({ model: e.target.value })}
              disabled={!canEdit}
              placeholder="Vivid E95"
            />
          </FormField>
          <FormField label="Manufacturer" hint="Printed as the last term.">
            <Input
              value={machine.manufacturer}
              onChange={(e) => onMachine({ manufacturer: e.target.value })}
              disabled={!canEdit}
              placeholder="GE HealthCare"
            />
          </FormField>
          <FormField
            label="Country of origin"
            hint="Printed beside the manufacturer."
          >
            <Input
              value={machine.origin}
              onChange={(e) => onMachine({ origin: e.target.value })}
              disabled={!canEdit}
              placeholder="USA"
            />
          </FormField>
        </FormGrid>
        <FormField
          label="Specification"
          hint="Optional. One line under the opening paragraph."
        >
          <Textarea
            value={machine.specification}
            onChange={(e) => onMachine({ specification: e.target.value })}
            disabled={!canEdit}
            rows={2}
            placeholder="4D cardiac imaging · 22-inch LCD monitor · 3 active probe ports"
          />
        </FormField>
        <FormGrid>
          <FormField
            label="Serial no"
            hint="Filled at delivery. Printed on the challan only."
          >
            <Input
              value={machine.serialNo}
              onChange={(e) => onMachine({ serialNo: e.target.value })}
              disabled={!canEdit}
              placeholder="At delivery"
            />
          </FormField>
          <FormField label="Sets" hint="How many of this machine.">
            <Input
              value={machine.qty}
              onChange={(e) => onMachine({ qty: e.target.value })}
              disabled={!canEdit}
              inputMode="numeric"
              aria-invalid={machineShort}
              className={cn(machineShort && "border-destructive")}
            />
          </FormField>
          <FormField label="Unit cost (৳)" hint="What it costs us. Optional.">
            <Input
              value={machine.unitCost}
              onChange={(e) => onMachine({ unitCost: e.target.value })}
              disabled={!canEdit}
              inputMode="decimal"
              placeholder="—"
              className="text-right"
            />
          </FormField>
          <FormField
            label="Price (৳)"
            hint="One figure for the set. Optional — an accessory may carry it instead."
          >
            <Input
              value={machine.unitPrice}
              onChange={(e) => onMachine({ unitPrice: e.target.value })}
              disabled={!canEdit}
              inputMode="decimal"
              placeholder="—"
              className="text-right"
            />
          </FormField>
        </FormGrid>
        <div className="flex flex-wrap items-center gap-3">
          {machine.kind === "external" ? (
            <span className="text-muted-foreground text-admin-2xs">
              External — not from inventory, so no stock moves for it.
            </span>
          ) : (
            <span className="text-muted-foreground text-admin-2xs">
              From inventory
              {machine.available != null
                ? ` · ${machine.available} available`
                : ""}
            </span>
          )}
          {machineShort && (
            <span className="text-destructive text-admin-2xs inline-flex items-center gap-1">
              <AlertTriangle className="size-3.5" aria-hidden />
              Only {machine.available} available
            </span>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive ml-auto gap-1.5"
              onClick={onRemoveMachine}
            >
              <Trash2 className="size-4" />
              Remove equipment
            </Button>
          )}
        </div>
      </div>

      {/* The numbered rows of the offer's table. */}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-sm font-medium">Accessories</h3>
          <p className="text-muted-foreground text-xs">
            Numbered under the equipment on the offer. A price is optional —
            leave it blank when the set price covers it. The offer prints
            quantity × unit price.
          </p>
          {canEdit && (
            <div className="ml-auto flex gap-1.5">
              <ProductPicker
                label="Add from inventory"
                variant="outline"
                onPick={(hit) =>
                  onAddAccessory(lineFromProduct(hit, "accessory"))
                }
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  onAddAccessory(emptyExternal("equipment", "accessory"))
                }
              >
                <Plus className="size-4" />
                Add accessory
              </Button>
            </div>
          )}
        </div>

        {accessories.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            None yet. The offer prints the equipment on its own.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="w-8 py-2">#</th>
                  <th className="w-[30%] py-2">Accessory</th>
                  <th className="w-[26%] py-2">Specification</th>
                  <th className="w-16 py-2 pr-5 text-right">Qty</th>
                  <th className="w-20 py-2">Unit</th>
                  <th className="w-24 py-2 pr-5 text-right">Unit cost</th>
                  <th className="w-28 py-2 pr-5 text-right">Unit price</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody>
                {accessories.map((a, i) => {
                  const short =
                    a.available != null && Number(a.qty) > a.available;
                  return (
                    <tr key={a.id ?? i} className="border-b align-top">
                      <td className="text-muted-foreground py-2">{i + 1}</td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.description}
                          onChange={(e) =>
                            onAccessory(i, { description: e.target.value })
                          }
                          disabled={!canEdit}
                          aria-label={`Accessory ${i + 1}`}
                          aria-invalid={!a.description.trim()}
                          className={cn(
                            "h-8",
                            !a.description.trim() && "border-destructive",
                          )}
                        />
                        {a.kind === "external" ? (
                          <span className="text-muted-foreground text-admin-2xs">
                            External — not from inventory
                          </span>
                        ) : null}
                        {short && (
                          <span className="text-destructive text-admin-2xs block">
                            Only {a.available} available
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.specification}
                          onChange={(e) =>
                            onAccessory(i, { specification: e.target.value })
                          }
                          disabled={!canEdit}
                          aria-label={`Specification for accessory ${i + 1}`}
                          className="h-8"
                          placeholder='(14"X17")'
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.qty}
                          onChange={(e) =>
                            onAccessory(i, { qty: e.target.value })
                          }
                          disabled={!canEdit}
                          inputMode="numeric"
                          aria-label={`Quantity for accessory ${i + 1}`}
                          aria-invalid={short}
                          className={cn(
                            "h-8 text-right",
                            short && "border-destructive",
                          )}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.unit}
                          onChange={(e) =>
                            onAccessory(i, { unit: e.target.value })
                          }
                          disabled={!canEdit}
                          aria-label={`Unit for accessory ${i + 1}`}
                          className="h-8"
                          placeholder="set"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.unitCost}
                          onChange={(e) =>
                            onAccessory(i, { unitCost: e.target.value })
                          }
                          disabled={!canEdit}
                          inputMode="decimal"
                          aria-label={`Unit cost for accessory ${i + 1}`}
                          placeholder="—"
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={a.unitPrice}
                          onChange={(e) =>
                            onAccessory(i, { unitPrice: e.target.value })
                          }
                          disabled={!canEdit}
                          inputMode="decimal"
                          aria-label={`Unit price for accessory ${i + 1}`}
                          placeholder="—"
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="py-1 text-right">
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive size-8"
                            aria-label={`Remove accessory ${i + 1}`}
                            onClick={() => onRemoveAccessory(i)}
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
      </div>

      {/* What the offer's table will total to, from what is typed above. */}
      <p className="text-muted-foreground text-xs">
        Set price{" "}
        <span className="text-foreground font-medium">
          {money(toMinor(machine.unitPrice) * (Number(machine.qty) || 0))}
        </span>
        {accessories.length > 0 && (
          <>
            {" · accessories "}
            <span className="text-foreground font-medium">
              {money(
                accessories.reduce(
                  (n, a) => n + toMinor(a.unitPrice) * (Number(a.qty) || 0),
                  0,
                ),
              )}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
