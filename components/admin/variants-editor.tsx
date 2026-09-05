"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fromMinor, toMinor } from "@/lib/money";
import { LocalizedInput, type LocalizedValue } from "./ui/localized-input";
import { FormField } from "./ui/form-shell";

export type VariantOptionValue = { en: string; bn?: string; ja?: string };
export type VariantOptionInput = {
  name: { en: string; bn?: string; ja?: string };
  values: VariantOptionValue[];
};
export type VariantInput = {
  id?: string;
  options: { name: string; value: string }[];
  sku: string;
  priceMinorOverride: number | null;
  stockQty: number;
};

type EditorOption = {
  name: LocalizedValue;
  valuesCsv: string;
};
type EditorVariant = {
  id?: string;
  options: { name: string; value: string }[];
  sku: string;
  price: string; // BDT major
  stock: string;
};

export type VariantsValue = {
  variantOptions: VariantOptionInput[];
  variants: VariantInput[];
};

function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])),
    [[]],
  );
}

const sig = (opts: { name: string; value: string }[]) =>
  opts.map((o) => `${o.name}=${o.value}`).join("|");

export function VariantsEditor({
  initial,
  onChange,
}: {
  initial?: VariantsValue;
  onChange: (v: VariantsValue) => void;
}) {
  const [options, setOptions] = useState<EditorOption[]>(
    (initial?.variantOptions ?? []).map((o) => ({
      name: { en: o.name.en, bn: o.name.bn ?? "", ja: o.name.ja ?? "" },
      valuesCsv: o.values.map((v) => v.en).join(", "),
    })),
  );
  const [variants, setVariants] = useState<EditorVariant[]>(
    (initial?.variants ?? []).map((v) => ({
      id: v.id,
      options: v.options,
      sku: v.sku,
      price:
        v.priceMinorOverride != null
          ? String(fromMinor(v.priceMinorOverride))
          : "",
      stock: String(v.stockQty),
    })),
  );

  // Emit serialized value whenever the editor changes.
  useEffect(() => {
    const variantOptions: VariantOptionInput[] = options
      .filter((o) => (o.name.en ?? "").trim())
      .map((o) => ({
        name: {
          en: (o.name.en ?? "").trim(),
          bn: (o.name.bn ?? "").trim() || undefined,
          ja: (o.name.ja ?? "").trim() || undefined,
        },
        values: o.valuesCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((en) => ({ en })),
      }))
      .filter((o) => o.values.length > 0);
    const serializedVariants: VariantInput[] = variants.map((v) => ({
      id: v.id,
      options: v.options,
      sku: v.sku.trim(),
      priceMinorOverride: v.price.trim() ? toMinor(Number(v.price) || 0) : null,
      stockQty: Number(v.stock) || 0,
    }));
    onChange({ variantOptions, variants: serializedVariants });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, variants]);

  function generate() {
    const defs = options
      .filter((o) => (o.name.en ?? "").trim() && o.valuesCsv.trim())
      .map((o) => ({
        name: (o.name.en ?? "").trim(),
        values: o.valuesCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }));
    if (defs.length === 0) {
      setVariants([]);
      return;
    }
    const combos = cartesian(defs.map((d) => d.values));
    const existingBySig = new Map(variants.map((v) => [sig(v.options), v]));
    const next: EditorVariant[] = combos.map((combo) => {
      const opts = combo.map((value, i) => ({ name: defs[i].name, value }));
      const prev = existingBySig.get(sig(opts));
      return prev ?? { options: opts, sku: "", price: "", stock: "0" };
    });
    setVariants(next);
  }

  return (
    <div className="grid gap-4">
      {/* Option definitions */}
      {options.length > 0 && (
        <div className="divide-border/60 bg-card divide-y rounded-lg shadow-[var(--shadow-sm)]">
          {options.map((o, i) => (
            <div
              key={i}
              className="grid items-end gap-3 px-3 py-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <LocalizedInput
                label={i === 0 ? "Option" : undefined}
                ariaLabel={`Option ${i + 1}`}
                value={o.name}
                placeholder="Size"
                onChange={(v) =>
                  setOptions((s) =>
                    s.map((x, j) => (j === i ? { ...x, name: v } : x)),
                  )
                }
              />
              <FormField
                label={i === 0 ? "Values (comma-separated)" : undefined}
                htmlFor={`variant-values-${i}`}
              >
                <Input
                  id={`variant-values-${i}`}
                  value={o.valuesCsv}
                  placeholder="S, M, L"
                  onChange={(e) =>
                    setOptions((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, valuesCsv: e.target.value } : x,
                      ),
                    )
                  }
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove option ${i + 1}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setOptions((s) => s.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setOptions((s) => [...s, { name: { en: "" }, valuesCsv: "" }])
          }
        >
          <Plus className="size-4" />
          Add option
        </Button>
        <Button type="button" size="sm" onClick={generate}>
          <Wand2 className="size-4" />
          Generate variants
        </Button>
        {variants.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {variants.length} variant{variants.length === 1 ? "" : "s"} — stock
            is held per variant and adjusted in Inventory.
          </span>
        )}
      </div>

      {/* Variant rows */}
      {variants.length > 0 && (
        <div className="bg-card overflow-hidden rounded-lg shadow-[var(--shadow-sm)]">
          <Table style={{ minWidth: 560 }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground h-9 px-3 text-[13px] font-semibold">
                  Variant
                </TableHead>
                <TableHead className="text-muted-foreground h-9 px-3 text-[13px] font-semibold">
                  SKU
                </TableHead>
                <TableHead className="text-muted-foreground h-9 px-3 text-[13px] font-semibold">
                  Price (BDT)
                </TableHead>
                <TableHead className="text-muted-foreground h-9 px-3 text-[13px] font-semibold">
                  Stock
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v, i) => {
                const label = v.options.map((o) => o.value).join(" · ");
                return (
                  <TableRow key={sig(v.options)}>
                    <TableCell className="px-3 py-2 align-middle text-[13px] font-medium">
                      {label}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        aria-label={`SKU for ${label}`}
                        className="h-8"
                        value={v.sku}
                        onChange={(e) =>
                          setVariants((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, sku: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        aria-label={`Price for ${label}`}
                        className="h-8"
                        type="number"
                        placeholder="(uses base)"
                        value={v.price}
                        onChange={(e) =>
                          setVariants((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, price: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        aria-label={`Stock for ${label}`}
                        className="h-8"
                        type="number"
                        value={v.stock}
                        onChange={(e) =>
                          setVariants((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, stock: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
