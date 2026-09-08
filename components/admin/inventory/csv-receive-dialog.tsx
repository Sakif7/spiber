"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import { MANUAL_TYPES, formatDelta, type ManualType } from "./types";
import { calloutClass } from "@/components/admin/ui/tone";

type PreviewLine = {
  line: number;
  sku: string;
  qty: number;
  reason: string | null;
  unit: {
    key: string;
    productId: string;
    variantId: string | null;
    name: string;
    variantLabel: string | null;
    sku: string;
    storefront: string;
    stock: number;
    tracked: boolean;
    seller: boolean;
  } | null;
  error: string | null;
};

type Preview = {
  lines: PreviewLine[];
  errors: { line: number; message: string }[];
  hadHeader: boolean;
};

const SAMPLE = `sku,qty,reason
MKT-BP-01,24,PO 4471
MKT-TEE-01-L-B,12`;

/**
 *"Receive CSV": paste or upload `sku,qty[,reason]`, preview every line
 * resolved against the catalog (unknown SKUs, seller units, resulting
 * balance), then apply the valid lines in one bulk request.
 */
export function CsvReceiveButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FileUp className="size-4" />
        Receive CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
          {open && <CsvForm onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CsvForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [type, setType] = useState<ManualType>("purchase");
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    applied: number;
    failed: number;
  } | null>(null);

  const valid = preview ? preview.lines.filter((l) => l.unit && !l.error) : [];
  const hasSeller = valid.some((l) => l.unit?.seller);
  const blocked = hasSeller && !override;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setPreview(null);
    setResult(null);
  }

  async function runPreview() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/inventory/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(formatApiError(json, "Could not read the file"));
        return;
      }
      setPreview(json.data as Preview);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (valid.length === 0 || blocked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reason: reason.trim() || undefined,
          override: hasSeller ? override : undefined,
          source: "csv",
          lines: valid.map((l) => ({
            productId: l.unit!.productId,
            ...(l.unit!.variantId ? { variantId: l.unit!.variantId } : {}),
            qtyDelta: l.qty,
            ...(l.reason ? { reason: l.reason } : {}),
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(formatApiError(json, "Could not apply the file"));
        return;
      }
      const data = json.data as { applied: number; failed: number };
      setResult(data);
      if (data.failed === 0) {
        toast.success(
          `${data.applied} line${data.applied === 1 ? "" : "s"} applied`,
        );
      } else {
        toast.warning(`${data.applied} applied, ${data.failed} failed`);
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>Receive stock from a CSV</DialogTitle>
        <DialogDescription>
          Columns <span className="font-mono">sku, qty, reason</span> (header
          optional; comma, semicolon or tab). Positive quantities are received,
          negative ones removed. Each line is applied on its own.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {!preview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="csv-file">File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {fileName ? `Loaded ${fileName}` : "or paste below"}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="csv-text">Rows</Label>
              <Textarea
                id="csv-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setPreview(null);
                }}
                placeholder={SAMPLE}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as ManualType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="csv-reason">Default reason (optional)</Label>
                <Input
                  id="csv-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Used when a line has no reason"
                />
              </div>
            </div>

            {hasSeller && (
              <label
                className={calloutClass("warning", "flex items-start gap-2")}
              >
                <Checkbox
                  checked={override}
                  onCheckedChange={(v) => setOverride(v === true)}
                />
                <span>
                  Some lines target seller-managed units. Override their
                  balances and notify the sellers.
                </span>
              </label>
            )}

            <div className="bg-card overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-semibold">Line</th>
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Change
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Balance
                    </th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {preview.lines.map((l) => (
                    <tr
                      key={l.line}
                      className={cn(l.error && "bg-destructive/5")}
                    >
                      <td className="text-muted-foreground px-3 py-1.5 tabular-nums">
                        {l.line}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{l.sku}</td>
                      <td className="max-w-[16rem] truncate px-3 py-1.5">
                        {l.unit ? (
                          <>
                            {l.unit.name}
                            {l.unit.variantLabel
                              ? ` · ${l.unit.variantLabel}`
                              : ""}
                            {l.unit.seller && (
                              <span className="text-muted-foreground">
                                {" "}
                                · seller
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {formatDelta(l.qty)}
                      </td>
                      <td className="text-muted-foreground px-3 py-1.5 text-right font-mono tabular-nums">
                        {l.unit
                          ? `${l.unit.stock} → ${l.unit.stock + l.qty}`
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        {l.error ? (
                          <span className="text-destructive">{l.error}</span>
                        ) : (
                          <span className="text-[var(--tone-success-fg)]">
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {preview.errors.map((e) => (
                    <tr key={`err-${e.line}`} className="bg-destructive/5">
                      <td className="text-muted-foreground px-3 py-1.5 tabular-nums">
                        {e.line}
                      </td>
                      <td className="text-destructive px-3 py-1.5" colSpan={5}>
                        {e.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-muted-foreground text-xs">
              {valid.length} of {preview.lines.length + preview.errors.length}{" "}
              lines ready
              {preview.hadHeader ? " · header row skipped" : ""}.
            </p>

            {result && (
              <p className="font-medium">
                Applied {result.applied}
                {result.failed > 0 ? `, ${result.failed} failed` : ""}. The
                inventory list has been refreshed.
              </p>
            )}
          </>
        )}

        {error && <p className="text-destructive">{error}</p>}
      </div>

      <DialogFooter className="border-t px-5 py-3">
        {!preview ? (
          <Button
            type="button"
            onClick={runPreview}
            disabled={busy || !text.trim()}
          >
            {busy ? "Reading…" : "Preview"}
          </Button>
        ) : result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={apply}
              disabled={busy || valid.length === 0 || blocked}
            >
              {busy
                ? "Applying…"
                : `Apply ${valid.length} line${valid.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
