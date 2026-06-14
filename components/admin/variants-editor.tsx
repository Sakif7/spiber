"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromMinor, toMinor } from "@/lib/money";

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
  nameEn: string;
  nameBn: string;
  nameJa: string;
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
      nameEn: o.name.en,
      nameBn: o.name.bn ?? "",
      nameJa: o.name.ja ?? "",
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
      .filter((o) => o.nameEn.trim())
      .map((o) => ({
        name: {
          en: o.nameEn.trim(),
          bn: o.nameBn.trim() || undefined,
          ja: o.nameJa.trim() || undefined,
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
      .filter((o) => o.nameEn.trim() && o.valuesCsv.trim())
      .map((o) => ({
        name: o.nameEn.trim(),
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

  const cell: React.CSSProperties = {
    padding: "6px 8px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    width: "100%",
    background: "var(--color-surface)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      {/* Option definitions */}
      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        {options.map((o, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1.4fr auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <Label>Option (EN)</Label>
              <Input
                value={o.nameEn}
                placeholder="Size"
                onChange={(e) =>
                  setOptions((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, nameEn: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Label>Option (বাংলা)</Label>
              <Input
                value={o.nameBn}
                onChange={(e) =>
                  setOptions((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, nameBn: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Label>Option (日本語)</Label>
              <Input
                value={o.nameJa}
                placeholder="日本語"
                onChange={(e) =>
                  setOptions((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, nameJa: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Label>Values (comma-separated)</Label>
              <Input
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
            </div>
            <button
              type="button"
              onClick={() => setOptions((s) => s.filter((_, j) => j !== i))}
              style={{
                height: 40,
                padding: "0 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-sm)",
                background: "transparent",
                color: "var(--color-error)",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() =>
              setOptions((s) => [
                ...s,
                { nameEn: "", nameBn: "", nameJa: "", valuesCsv: "" },
              ])
            }
            style={btn("secondary")}
          >
            + Add option
          </button>
          <button type="button" onClick={generate} style={btn("primary")}>
            Generate variants
          </button>
        </div>
      </div>

      {/* Variant rows */}
      {variants.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}
          >
            <thead>
              <tr>
                <th style={th}>Variant</th>
                <th style={th}>SKU</th>
                <th style={th}>Price (BDT)</th>
                <th style={th}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={sig(v.options)}>
                  <td style={td}>
                    {v.options.map((o) => o.value).join(" · ")}
                  </td>
                  <td style={td}>
                    <input
                      style={cell}
                      value={v.sku}
                      onChange={(e) =>
                        setVariants((s) =>
                          s.map((x, j) =>
                            j === i ? { ...x, sku: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={td}>
                    <input
                      style={cell}
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
                  </td>
                  <td style={td}>
                    <input
                      style={cell}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "var(--fs-caption)",
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
};
const td: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
  fontSize: "var(--fs-body-sm)",
};
const btn = (variant: "primary" | "secondary"): React.CSSProperties => ({
  height: 40,
  padding: "0 16px",
  borderRadius: "var(--r-pill)",
  border: variant === "primary" ? "none" : "1px solid var(--color-border)",
  background: variant === "primary" ? "var(--color-brand)" : "transparent",
  color: variant === "primary" ? "#fff" : "var(--color-text)",
  fontWeight: 600,
  cursor: "pointer",
});
