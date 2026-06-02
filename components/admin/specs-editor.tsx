"use client";

import { Input } from "@/components/ui/input";

export type SpecRow = {
  key: { en: string; bn?: string };
  value: { en: string; bn?: string };
};

export function SpecsEditor({
  value,
  onChange,
}: {
  value: SpecRow[];
  onChange: (rows: SpecRow[]) => void;
}) {
  const update = (i: number, patch: Partial<SpecRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {value.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <Input
              placeholder="Key (EN)"
              value={row.key.en}
              onChange={(e) =>
                update(i, { key: { ...row.key, en: e.target.value } })
              }
            />
            <Input
              placeholder="Key (বাংলা)"
              value={row.key.bn ?? ""}
              onChange={(e) =>
                update(i, { key: { ...row.key, bn: e.target.value } })
              }
            />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <Input
              placeholder="Value (EN)"
              value={row.value.en}
              onChange={(e) =>
                update(i, { value: { ...row.value, en: e.target.value } })
              }
            />
            <Input
              placeholder="Value (বাংলা)"
              value={row.value.bn ?? ""}
              onChange={(e) =>
                update(i, { value: { ...row.value, bn: e.target.value } })
              }
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            style={{
              border: 0,
              background: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([...value, { key: { en: "" }, value: { en: "" } }])
        }
        style={{
          justifySelf: "start",
          padding: "6px 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
          cursor: "pointer",
          fontSize: "var(--fs-small)",
        }}
      >
        + Add spec
      </button>
    </div>
  );
}
