/**
 * Parser for the "receive stock" CSV upload. Pure and dependency-free.
 *
 * Accepted shape (a header row is optional; comma, semicolon or tab delimited;
 * quoted fields allowed):
 *
 *   sku,qty,reason
 *   MKT-BP-01,24,PO 4471
 *   MKT-TEE-01-L-B,12
 *
 * `qty` is the change to apply (a delivery = positive; a negative number is a
 * write-off). Zero and non-integers are rejected per line so one bad row never
 * blocks the rest — the caller shows the errors next to the valid lines.
 */

export type CsvReceiveLine = {
  /** 1-based line number in the file (for error messages). */
  line: number;
  sku: string;
  qty: number;
  reason?: string;
};

export type CsvReceiveError = { line: number; message: string };

export type CsvReceiveParse = {
  lines: CsvReceiveLine[];
  errors: CsvReceiveError[];
  /** True when the first row was recognised as a header and skipped. */
  hadHeader: boolean;
};

const MAX_LINES_DEFAULT = 500;

function detectDelimiter(firstLine: string): string {
  const counts: [string, number][] = [",", ";", "\t"].map((d) => [
    d,
    firstLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Split one CSV record into fields, honouring double quotes ("" escapes a quote). */
export function splitCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

const SKU_HEADERS = new Set(["sku", "code", "product", "variant sku"]);
const QTY_HEADERS = new Set([
  "qty",
  "quantity",
  "delta",
  "change",
  "received",
  "units",
]);
const REASON_HEADERS = new Set(["reason", "note", "notes", "reference", "ref"]);

export function parseReceiveCsv(
  text: string,
  opts: { maxLines?: number } = {},
): CsvReceiveParse {
  const maxLines = opts.maxLines ?? MAX_LINES_DEFAULT;
  const rawLines = text.replace(/^﻿/, "").split(/\r?\n/);
  const lines: CsvReceiveLine[] = [];
  const errors: CsvReceiveError[] = [];

  const firstContent = rawLines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  let skuIdx = 0;
  let qtyIdx = 1;
  let reasonIdx: number | null = 2;
  let hadHeader = false;
  let headerConsumed = false;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw.trim() === "") continue;
    const lineNo = i + 1;
    const fields = splitCsvLine(raw, delimiter);

    if (!headerConsumed) {
      headerConsumed = true;
      const lower = fields.map((f) => f.toLowerCase());
      if (lower.some((f) => SKU_HEADERS.has(f))) {
        hadHeader = true;
        skuIdx = lower.findIndex((f) => SKU_HEADERS.has(f));
        const q = lower.findIndex((f) => QTY_HEADERS.has(f));
        qtyIdx = q >= 0 ? q : skuIdx === 0 ? 1 : 0;
        const r = lower.findIndex((f) => REASON_HEADERS.has(f));
        reasonIdx = r >= 0 ? r : null;
        continue;
      }
    }

    if (lines.length + errors.length >= maxLines) {
      errors.push({
        line: lineNo,
        message: `Too many rows — at most ${maxLines} per upload`,
      });
      break;
    }

    const sku = (fields[skuIdx] ?? "").trim();
    const qtyRaw = (fields[qtyIdx] ?? "").trim();
    const reason =
      reasonIdx != null ? (fields[reasonIdx] ?? "").trim() : undefined;

    if (!sku) {
      errors.push({ line: lineNo, message: "Missing SKU" });
      continue;
    }
    if (!/^[+-]?\d+$/.test(qtyRaw)) {
      errors.push({
        line: lineNo,
        message: qtyRaw
          ? `Quantity "${qtyRaw}" is not a whole number`
          : "Missing quantity",
      });
      continue;
    }
    const qty = Number(qtyRaw);
    if (qty === 0) {
      errors.push({ line: lineNo, message: "Quantity cannot be zero" });
      continue;
    }
    lines.push({
      line: lineNo,
      sku,
      qty,
      reason: reason ? reason.slice(0, 500) : undefined,
    });
  }

  return { lines, errors, hadHeader };
}
