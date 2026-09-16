import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { interpolate } from "../resolve";
import { frameStyle, type BlockProps } from "./shared";

/**
 * The closing signature row.
 *
 * The templates label the left line "Approved By" and, on an invoice, add
 * "Received By" on the right. The signatory's name and role sit under the
 * left line when asked for, as they do on the documents the company actually
 * sent — a bare "Approved By" tells the reader nothing about who approved it.
 *
 * Two lines make two equal columns: "Approved By" against the left margin,
 * "Received By" against the right; a lone left block (the proposal) sits
 * where the company's letters have always signed. Space is left above each line for a real pen.
 * No signature image and no seal is ever drawn: those are what make the
 * paper copy the original. Never split across pages: a signature line
 * orphaned on a blank sheet is not a sign-off.
 */
export function SignOffBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"signOff">) {
  const { left, right, includeSignatory, labelAlign } = block.props;
  const signatory = includeSignatory ? ctx.signatory : undefined;

  const label = [
    styles.small,
    styles.label,
    styles.signLabel,
    // The theme centres the label; a template may range it left instead.
    labelAlign === "left" ? { textAlign: "left" as const } : {},
  ];
  return (
    <View style={[styles.signRow, frameStyle(block, styles)]} wrap={false}>
      <View style={styles.signCol}>
        <View style={styles.signBox}>
          <View style={{ height: 26 }} />
          <View style={styles.signLine}>
            <Text style={label}>{interpolate(left, ctx, kind)}</Text>
          </View>
          {signatory ? (
            /* Ranged left under the rule: a centred address block reads as
               a title page, and the client asked for the name to stay put.
               The block as a whole is what the column centres. */
            <View style={{ paddingTop: 2 }}>
              <Text style={styles.small}>{signatory.name}</Text>
              {/* The designation carries the authority the signature
                  claims, so it is the line set in bold. */}
              <Text style={[styles.small, styles.label]}>
                {signatory.title}
              </Text>
              <Text style={styles.small}>{ctx.company.name}</Text>
              {signatory.phone ? (
                <Text style={styles.small}>Contact: {signatory.phone}</Text>
              ) : null}
              {signatory.email ? (
                <Text style={styles.small}>E-mail: {signatory.email}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {right ? (
        <View style={[styles.signCol, styles.signColRight]}>
          <View style={styles.signBox}>
            <View style={{ height: 26 }} />
            <View style={styles.signLine}>
              <Text style={label}>{interpolate(right, ctx, kind)}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
