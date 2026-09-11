import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { LineColumn, LineColumnKey } from "@/lib/schemas/pdf-template";
import { needsVatColumn, vatCell, type DocumentLine } from "../../types";
import { formatTaka } from "../../format";
import { formatPath, interpolate, isPresent, resolvePath } from "../resolve";
import type { Styles } from "../theme";
import { frameProps, frameStyle, type BlockProps } from "./shared";

/**
 * The ruled table of line items, with the totals stacked inside its border.
 *
 * Ruled like the samples, but the weight is graded rather than uniform: a
 * hairline between cells, a full rule around the table and under the head. The
 * columns to the left of a totals label are ONE empty cell rather than four
 * ruled ones — a stack of empty boxes running down the page was the thing
 * that made the old table read as a grid.
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

  return (
    <View
      style={[styles.table, frameStyle(block, styles)]}
      {...frameProps(block)}
    >
      <View style={styles.trHead}>
        {columns.map((c) => (
          <Text
            key={c.key}
            style={[styles.th, col(c.weight, c.key === lastKey)]}
          >
            {c.label}
          </Text>
        ))}
      </View>

      {lines.map((line, i) => (
        <View key={i} style={styles.tr}>
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
      ))}

      {totalsRows.map((r, i) => {
        const first = i === 0;
        const last = i === totalsRows.length - 1;
        const row = first
          ? styles.trTotalsStart
          : last
            ? styles.trLast
            : styles.tr;
        return (
          <View key={r.id} style={row}>
            {spanWeight > 0 ? (
              <View style={[styles.tdSpan, col(spanWeight)]} />
            ) : null}
            <Text
              style={[styles.td, styles.tdNum, col(labelWeight), styles.label]}
            >
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
          </View>
        );
      })}
    </View>
  );
}
