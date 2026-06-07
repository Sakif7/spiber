"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { bulkSpecPasteFromText, parseSpecLines } from "@/lib/specs/parse";

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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const update = (i: number, patch: Partial<SpecRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const isEmptyRow = (r: SpecRow) =>
    !r.key.en && !r.key.bn && !r.value.en && !r.value.bn;

  /**
   * Smart paste: if a multi-line block where EVERY non-empty line is a clean
   * "Key: Value" pair is pasted into a spec field, split it into separate
   * specs (replacing the row being pasted into). Single-line or "messy"
   * pastes fall through to the normal paste so we never hijack ordinary input.
   */
  const handleSmartPaste = (
    i: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pairs = bulkSpecPasteFromText(e.clipboardData.getData("text"));
    if (!pairs) return; // single line / messy → normal paste
    e.preventDefault();
    const rows: SpecRow[] = pairs.map((p) => ({
      key: { en: p.key },
      value: { en: p.value },
    }));
    onChange([...value.slice(0, i), ...rows, ...value.slice(i + 1)]);
  };

  const importBulk = () => {
    const pairs = parseSpecLines(bulkText);
    if (pairs.length === 0) return;
    const rows: SpecRow[] = pairs.map((p) => ({
      key: { en: p.key },
      value: { en: p.value },
    }));
    const cleaned = value.filter((r) => !isEmptyRow(r));
    onChange([...cleaned, ...rows]);
    setBulkText("");
    setBulkOpen(false);
  };

  const bulkPreview = parseSpecLines(bulkText).length;

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
              onPaste={(e) => handleSmartPaste(i, e)}
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
              onPaste={(e) => handleSmartPaste(i, e)}
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() =>
            onChange([...value, { key: { en: "" }, value: { en: "" } }])
          }
          style={ghostBtn}
        >
          + Add spec
        </button>
        <button
          type="button"
          onClick={() => setBulkOpen((o) => !o)}
          style={ghostBtn}
        >
          {bulkOpen ? "Close bulk paste" : "Paste a list"}
        </button>
      </div>

      {bulkOpen && (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 12,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface-2)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-small)",
              color: "var(--color-text-muted)",
            }}
          >
            Paste one spec per line as <code>Key: Value</code> (or tab / =
            separated). Each line becomes its own spec.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Model: ECG-100\nColor: White\nWeight: 4.2 kg"}
            rows={5}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              resize: "vertical",
              color: "var(--color-text)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={importBulk}
              disabled={bulkPreview === 0}
              style={{
                ...ghostBtn,
                background:
                  bulkPreview === 0
                    ? "var(--color-surface-2)"
                    : "var(--color-brand)",
                color: bulkPreview === 0 ? "var(--color-text-muted)" : "#fff",
                borderColor:
                  bulkPreview === 0
                    ? "var(--color-border)"
                    : "var(--color-brand)",
                cursor: bulkPreview === 0 ? "not-allowed" : "pointer",
              }}
            >
              Add {bulkPreview} spec{bulkPreview === 1 ? "" : "s"}
            </button>
            <span
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--color-text-muted)",
              }}
            >
              {bulkPreview === 0
                ? "Nothing detected yet"
                : `${bulkPreview} spec${bulkPreview === 1 ? "" : "s"} detected`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  justifySelf: "start",
  padding: "6px 12px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  cursor: "pointer",
  fontSize: "var(--fs-small)",
};
