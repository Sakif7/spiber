"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bulkSpecPasteFromText, parseSpecLines } from "@/lib/specs/parse";
import { LocalizedInput } from "./ui/localized-input";

export type SpecRow = {
  key: { en: string; bn?: string; ja?: string };
  value: { en: string; bn?: string; ja?: string };
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
    !r.key.en &&
    !r.key.bn &&
    !r.key.ja &&
    !r.value.en &&
    !r.value.bn &&
    !r.value.ja;

  /**
   * Smart paste: if a multi-line block where EVERY non-empty line is a clean
   *"Key: Value" pair is pasted into a spec field, split it into separate
   * specs (replacing the row being pasted into). Single-line or"messy"
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
    <div className="grid gap-3">
      {value.length > 0 && (
        <div className="divide-border/60 bg-card divide-y rounded-lg border">
          {value.map((row, i) => (
            <div
              key={i}
              className="grid items-end gap-3 px-3 py-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <LocalizedInput
                label={i === 0 ? "Key" : undefined}
                ariaLabel={`Key ${i + 1}`}
                value={row.key}
                placeholder="e.g. Country of Origin"
                onChange={(v) =>
                  update(i, { key: { ...row.key, ...v, en: v.en ?? "" } })
                }
                onPasteEn={(e) => handleSmartPaste(i, e)}
              />
              <LocalizedInput
                label={i === 0 ? "Value" : undefined}
                ariaLabel={`Value ${i + 1}`}
                value={row.value}
                placeholder="e.g. Japan"
                onChange={(v) =>
                  update(i, { value: { ...row.value, ...v, en: v.en ?? "" } })
                }
                onPasteEn={(e) => handleSmartPaste(i, e)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove spec ${i + 1}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
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
            onChange([...value, { key: { en: "" }, value: { en: "" } }])
          }
        >
          <Plus className="size-4" />
          Add spec
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setBulkOpen((o) => !o)}
        >
          {bulkOpen ? "Close bulk paste" : "Paste a list"}
        </Button>
      </div>

      {bulkOpen && (
        <div className="bg-muted/40 grid gap-2 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            Paste one spec per line as{" "}
            <code className="font-mono">Key: Value</code> (or tab / =
            separated). Each line becomes its own spec.
          </p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Model: ECG-100\nColor: White\nWeight: 4.2 kg"}
            rows={5}
            aria-label="Specs to import"
            className="font-mono"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={importBulk}
              disabled={bulkPreview === 0}
            >
              Add {bulkPreview} spec{bulkPreview === 1 ? "" : "s"}
            </Button>
            <span className="text-muted-foreground text-xs">
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
