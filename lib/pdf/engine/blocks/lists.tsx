import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { allPlaceholdersEmpty, interpolate, isShown } from "../resolve";
import { frameProps, frameStyle, type BlockProps } from "./shared";
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
  const { heading, headingGap, items } = block.props;
  const list = items.map((item, i) => (
    <View key={i} style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
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
      <Text key={i} style={{ marginBottom: 1 }}>
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
}: BlockProps<"keyValueTable">) {
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
    />
  );
}
