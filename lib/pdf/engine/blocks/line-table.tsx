import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type {
  ColumnTotals,
  LineColumn,
  LineColumnKey,
} from "@/lib/schemas/pdf-template";
import { needsVatColumn, vatCell, type DocumentLine } from "../../types";
import { formatTaka } from "../../format";
import { formatPath, interpolate, isPresent, resolvePath } from "../resolve";
import type { Styles } from "../theme";
import { frameStyle, type BlockProps } from "./shared";
import { PagedTable } from "./paged-table";

/**
 * The ruled table of line items, with the totals stacked inside its border.
 *
 * Ruled like the samples, but the weight is graded rather than uniform: a
 * hairline between cells, a full rule around the table and under the head. The
 * columns to the left of a totals label are ONE empty cell rather than four
 * ruled ones — a stack of empty boxes running down the page was the thing
 * that made the old table read as a grid.
 *
 * Page breaks are `PagedTable`'s: rows move whole, the head repeats, the
 * totals stay with the last item.
 */

const col = (flex: number, last = false) => ({
  flex,
  ...(last ? { borderRightWidth: 0 } : {}),
});

function alignStyle(align: LineColumn["align"], styles: Styles) {
  return align === "right"
    ? styles.tdNum
    : align === "left"
      ? styles.tdText
      : {};
}

/**
 * The column-aligned totals line, laid out on the same grid as the items.
 *
 * Walks the visible columns in order: a column with a figure gets its own
 * cell; a run of columns without one merges into a single span, and the
 * first such run — the one before any figure — carries the label, ranged
 * right so it sits against the first figure. One span rather than one box
 * per empty column is what keeps this reading as a totals line and not as
 * an extra, mostly empty, item row.
 */
type AlignedCell =
  | { kind: "span"; weight: number; label?: string; last: boolean }
  | {
      kind: "figure";
      weight: number;
      column: LineColumn;
      text: string;
      emphasis: boolean;
      last: boolean;
    };

function alignedCells(
  columns: LineColumn[],
  totals: ColumnTotals,
  format: (path: string) => string,
): AlignedCell[] {
  const byKey = new Map(totals.cells.map((c) => [c.column, c]));
  const out: AlignedCell[] = [];
  let labelPlaced = false;
  for (const [i, col] of columns.entries()) {
    const last = i === columns.length - 1;
    const cell = byKey.get(col.key);
    if (cell) {
      out.push({
        kind: "figure",
        weight: col.weight,
        column: col,
        text: format(cell.path),
        emphasis: cell.emphasis,
        last,
      });
      continue;
    }
    const prev = out[out.length - 1];
    if (prev?.kind === "span") {
      prev.weight += col.weight;
      prev.last = last;
    } else {
      out.push({
        kind: "span",
        weight: col.weight,
        label: labelPlaced ? undefined : totals.label,
        last,
      });
      labelPlaced = true;
    }
  }
  return out;
}

function cellText(key: LineColumnKey, line: DocumentLine, n: number): string {
  switch (key) {
    case "sn":
      return String(n);
    case "description":
      return line.description;
    case "brandOrigin":
      return line.brandOrigin ?? "";
    case "specification":
      return line.specification ?? "";
    case "qty":
      return String(line.qty);
    case "unit":
      return line.unit ?? "";
    case "unitPrice":
      return formatTaka(line.unitPriceMinor);
    case "vat":
      return vatCell(line);
    case "lineTotal":
      return formatTaka(line.lineTotalMinor);
  }
}

export function LineTableBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"lineTable">) {
  const { vatColumn, totals } = block.props;
  const lines = ctx.lines;
  const showVat =
    vatColumn === "always" || (vatColumn === "auto" && needsVatColumn(lines));
  const columns = block.props.columns.filter(
    (c) => c.visible && (c.key !== "vat" || showVat),
  );
  const lastKey = columns[columns.length - 1]?.key;
  const weight = (keys: readonly LineColumnKey[]) =>
    columns
      .filter((c) => keys.includes(c.key))
      .reduce((n, c) => n + c.weight, 0);

  const totalsRows = (totals?.rows ?? []).filter((r) => {
    if (!r.hideWhenZero) return true;
    const v = resolvePath(ctx, r.path);
    return typeof v === "number" ? v > 0 : isPresent(v);
  });
  // The empty run: every column before the first one the label occupies.
  const labelSet = new Set(totals?.labelColumns ?? []);
  const valueSet = new Set(totals?.valueColumns ?? []);
  const firstLabelAt = columns.findIndex((c) => labelSet.has(c.key));
  const spanKeys = columns
    .slice(0, firstLabelAt < 0 ? columns.length : firstLabelAt)
    .map((c) => c.key);
  const spanWeight = weight(spanKeys);
  const labelWeight = weight([...labelSet]);
  const valueWeight = weight([...valueSet]);
  const valueIsLast = lastKey != null && valueSet.has(lastKey);

  const aligned = totals?.columnTotals
    ? alignedCells(columns, totals.columnTotals, (p) =>
        formatPath(ctx, kind, p),
      )
    : null;

  const head = (
    <View style={styles.trHead}>
      {columns.map((c) => (
        <Text key={c.key} style={[styles.th, col(c.weight, c.key === lastKey)]}>
          {c.label}
        </Text>
      ))}
    </View>
  );

  // The row that closes the table takes the bottom rule with it.
  const closes = (i: number, of: number) =>
    i === of - 1 ? styles.trClose : {};
  const tailCount = (aligned ? 1 : 0) + totalsRows.length;

  const rows = lines.map((line, i) => (
    <View key={i} style={[styles.tr, tailCount ? {} : closes(i, lines.length)]}>
      {columns.map((c) => {
        const raw = cellText(c.key, line, i + 1);
        return (
          <Text
            key={c.key}
            style={[
              styles.td,
              alignStyle(c.align, styles),
              col(c.weight, c.key === lastKey),
            ]}
          >
            {raw === "" && c.emptyText ? c.emptyText : raw}
          </Text>
        );
      })}
    </View>
  ));

  const tail: React.ReactElement<React.ComponentProps<typeof View>>[] = [];
  if (aligned) {
    // The full rule above it marks the end of the items; the row is the
    // start of the totals whether or not a stack follows.
    tail.push(
      <View
        key="aligned"
        style={[
          totalsRows.length ? styles.trTotalsStart : styles.trTotalsOnly,
          closes(0, tailCount),
        ]}
      >
        {aligned.map((c, i) =>
          c.kind === "span" ? (
            <Text
              key={i}
              style={[
                styles.td,
                styles.tdNum,
                col(c.weight, c.last),
                styles.label,
              ]}
            >
              {c.label ? interpolate(c.label, ctx, kind) : ""}
            </Text>
          ) : (
            <Text
              key={i}
              style={[
                styles.td,
                alignStyle(c.column.align, styles),
                col(c.weight, c.last),
                styles.label,
                c.emphasis ? styles.tdStrong : {},
              ]}
            >
              {c.text}
            </Text>
          ),
        )}
      </View>,
    );
  }

  totalsRows.forEach((r, i) => {
    // With an aligned line above, the stack continues under a hairline
    // rather than opening the totals with a second full rule.
    const first = i === 0 && !aligned;
    const last = i === totalsRows.length - 1;
    const row = first ? styles.trTotalsStart : last ? styles.trLast : styles.tr;
    tail.push(
      <View key={r.id} style={[row, last ? styles.trClose : {}]}>
        {spanWeight > 0 ? (
          <View style={[styles.tdSpan, col(spanWeight)]} />
        ) : null}
        <Text style={[styles.td, styles.tdNum, col(labelWeight), styles.label]}>
          {interpolate(r.label, ctx, kind)}
        </Text>
        <Text
          style={[
            styles.td,
            r.valueAlign === "right" ? styles.tdNum : {},
            col(valueWeight, valueIsLast),
            styles.label,
            r.emphasis ? styles.tdStrong : {},
          ]}
        >
          {(r.prefix ?? "") + formatPath(ctx, kind, r.path)}
        </Text>
      </View>,
    );
  });

  return (
    <PagedTable
      head={head}
      rows={rows}
      tail={tail}
      style={{ ...styles.table, ...frameStyle(block, styles) }}
      keepTogether={block.keepTogether}
      minPresenceAhead={block.minPresenceAhead}
    />
  );
}
