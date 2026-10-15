import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { allPlaceholdersEmpty, interpolate, isShown } from "../resolve";
import {
  frameProps,
  frameStyle,
  type BlockProps,
  type TableBlockProps,
} from "./shared";
import { PagedTable } from "./paged-table";

/**
 * The header blocks: our reference on the left, the client on the right.
 *
 * Each column is a run of "Label: value" lines. A line whose placeholders all
 * come back empty is dropped when it says so, which is how "Customer ID:"
 * appears only for clients that have one.
 */
export function MetaColumnsBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"metaColumns">) {
  const { gap, lineGap, columns } = block.props;
  const lineStyle = lineGap > 0 ? { marginBottom: lineGap } : {};
  return (
    <View
      style={[{ flexDirection: "row", gap }, frameStyle(block, styles)]}
      {...frameProps(block)}
    >
      {columns.map((colDef, ci) => (
        <View
          key={ci}
          style={[
            styles.partyCol,
            colDef.align === "right" ? { alignItems: "flex-end" } : {},
          ]}
        >
          {colDef.heading ? (
            <Text style={styles.partyHeading}>
              {interpolate(colDef.heading, ctx, kind)}
            </Text>
          ) : null}
          {colDef.fields.map((f, fi) => {
            if (f.hideWhenEmpty && allPlaceholdersEmpty(f.value, ctx)) {
              return null;
            }
            return (
              <Text
                key={fi}
                style={[
                  lineStyle,
                  f.bold ? styles.label : {},
                  f.small ? styles.small : {},
                ]}
              >
                {f.label ? (
                  <Text style={styles.label}>
                    {interpolate(f.label, ctx, kind)}{" "}
                  </Text>
                ) : null}
                {interpolate(f.value, ctx, kind)}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Terms and conditions: an optional heading over a bulleted list. */
export function BulletsBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"bullets">) {
  const { heading, headingGap, items, numbered, hideEmptyItems } = block.props;
  const shown = hideEmptyItems
    ? items.filter((item) => !allPlaceholdersEmpty(item, ctx))
    : items;
  const list = shown.map((item, i) => (
    <View key={i} style={styles.bulletRow}>
      {/* Numbers range right so "1." and "10." end on the same column;
          the dot keeps the centred width every existing template prints. */}
      <Text
        style={
          numbered
            ? [
                styles.bulletDot,
                { width: 18, textAlign: "right", paddingRight: 4 },
              ]
            : styles.bulletDot
        }
      >
        {numbered ? `${i + 1}.` : "•"}
      </Text>
      <Text style={styles.bulletText}>{interpolate(item, ctx, kind)}</Text>
    </View>
  ));
  return (
    <View style={frameStyle(block, styles)} {...frameProps(block)}>
      {heading ? (
        <>
          <Text style={styles.underlineLabel}>
            {interpolate(heading, ctx, kind)}
          </Text>
          <View style={{ marginTop: headingGap }}>{list}</View>
        </>
      ) : (
        list
      )}
    </View>
  );
}

/**
 * Numbered terms with their values aligned in a column.
 *
 * "1.  Payment Terms      :  100% advance payment." — the label column is a
 * fixed width so every separator lines up, and a value that runs on wraps
 * under itself rather than under the number. A row whose value is empty is
 * dropped when it says so, which is how "Manufacturer" disappears from an
 * offer for a machine nobody has named a maker for.
 */
export function LabelledListBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"labelledList">) {
  const { heading, headingGap, numbered, labelWidth, separator, items } =
    block.props;
  const shown = items.filter(
    (i) => !(i.hideWhenEmpty && allPlaceholdersEmpty(i.text, ctx)),
  );
  const list = shown.map((item, i) => (
    <View key={i} style={styles.termRow}>
      {numbered ? <Text style={styles.termNo}>{`${i + 1}.`}</Text> : null}
      <Text style={[{ width: labelWidth }, styles.label]}>
        {interpolate(item.label, ctx, kind)}
      </Text>
      <Text style={styles.termSep}>{separator}</Text>
      <Text style={styles.termText}>{interpolate(item.text, ctx, kind)}</Text>
    </View>
  ));
  return (
    <View style={frameStyle(block, styles)} {...frameProps(block)}>
      {heading ? (
        <>
          <Text style={styles.underlineLabel}>
            {interpolate(heading, ctx, kind)}
          </Text>
          <View style={{ marginTop: headingGap }}>{list}</View>
        </>
      ) : (
        list
      )}
    </View>
  );
}

/** "Payment Information": a heading over "Label: value" lines. */
export function KeyValueListBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"keyValueList">) {
  const { heading, headingGap, items } = block.props;
  const list = items.map((item, i) => {
    if (item.hideWhenEmpty && allPlaceholdersEmpty(item.value, ctx)) {
      return null;
    }
    return (
      <Text key={i} style={styles.keyValueLine}>
        <Text style={styles.label}>{interpolate(item.label, ctx, kind)} </Text>
        {interpolate(item.value, ctx, kind)}
      </Text>
    );
  });
  return (
    <View style={frameStyle(block, styles)} {...frameProps(block)}>
      {heading ? (
        <>
          <Text style={styles.underlineLabel}>
            {interpolate(heading, ctx, kind)}
          </Text>
          <View style={{ marginTop: headingGap }}>{list}</View>
        </>
      ) : (
        list
      )}
    </View>
  );
}

/**
 * A two-column ruled table of labels and figures — the payslip's basis.
 * The last row closes the table with a full rule rather than a hairline.
 * Page breaks are `PagedTable`'s: rows move whole and the head repeats.
 */
export function KeyValueTableBlock({
  block,
  styles,
  ctx,
  kind,
  after,
}: TableBlockProps<"keyValueTable">) {
  const { header, headerRule, rows } = block.props;
  const shown = rows.filter((r) => isShown(ctx, r.showIf));
  // Without a head the first row opens the frame with the top rule.
  const opens = header
    ? {}
    : { borderTopWidth: 1, borderTopColor: styles.trHead.borderColor };
  const body = shown.map((r, i) => {
    const last = i === shown.length - 1;
    return (
      <View
        key={i}
        style={[
          last ? styles.trLast : styles.tr,
          last ? styles.trClose : {},
          i === 0 ? opens : {},
        ]}
      >
        <Text style={[styles.td, { flex: 2 }, styles.label]}>
          {interpolate(r.label, ctx, kind)}
        </Text>
        <Text
          style={[
            styles.td,
            { flex: 2, textAlign: "right", borderRightWidth: 0 },
            ...(r.strong ? [styles.label] : []),
          ]}
        >
          {interpolate(r.value, ctx, kind)}
        </Text>
      </View>
    );
  });
  const head = header ? (
    <View
      style={[
        headerRule === "full" ? styles.trHead : styles.tr,
        { borderTopWidth: 1, borderTopColor: styles.trHead.borderColor },
      ]}
    >
      <Text style={[styles.th, { flex: 2 }]}>{header.label}</Text>
      <Text style={[styles.th, { flex: 2, borderRightWidth: 0 }]}>
        {header.value}
      </Text>
    </View>
  ) : null;
  return (
    <PagedTable
      head={head}
      rows={body}
      style={{ ...styles.table, ...frameStyle(block, styles) }}
      keepTogether={block.keepTogether}
      minPresenceAhead={block.minPresenceAhead}
      after={after}
    />
  );
}
