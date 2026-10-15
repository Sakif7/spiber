import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/money-words";
import { formatTaka } from "../../format";
import { interpolate } from "../resolve";
import type { RenderContext } from "../context";
import { frameStyle, type TableBlockProps } from "./shared";
import { PagedTable } from "./paged-table";

/**
 * The price offer's table: the machine, its accessories, one total.
 *
 * Deliberately not the ruled grid the consumables documents use. This is the
 * company's own offer layout, taken from the paper they compete against:
 * three horizontal rules and no boxes at all, a bold row naming the set and
 * carrying the whole price, the accessories numbered beneath it with their
 * quantities, and a closing row whose label spells the figure out in words.
 *
 *   Price: BDT                                  Delivery: Local Delivery
 *   ──────────────────────────────────────────────────────────────────
 *   NO                                  Qty                     Price
 *   ──────────────────────────────────────────────────────────────────
 *   FUJIFILM Brand Computed Radiography                   14,00,000/=
 *    1.  FCR PRIMA T 2                  1 set
 *    2.  FCR Console                    1 set
 *   VAT (15%)                                              2,10,000/=
 *   ──────────────────────────────────────────────────────────────────
 *   Total Price BDT. Sixteen Lakh Ten Thousand Taka Only  16,10,000/=
 *
 * An accessory's price cell is empty unless one was entered — the usual
 * offer quotes one figure for the set — and the whole price column can be
 * switched off for a document that states no money at all.
 *
 * VAT is a row of its own above the total, its rate in the label and its
 * figure in the column, and the total then includes it — the owner's
 * choice, so the client reads one figure for what the machine costs them.
 * A template saved before the row existed has no `vatLabel`, and keeps
 * totalling the goods alone with VAT stated under the table.
 */

/** An accessory as the context hands it over. */
type Row = {
  no: number;
  name: string;
  spec: string | null;
  qty: string;
  priceMinor: number | null;
};

function rowsOf(ctx: RenderContext): Row[] {
  const raw = ctx.accessories;
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const a = (r ?? {}) as Record<string, unknown>;
    return {
      no: i + 1,
      name: typeof a.name === "string" ? a.name : "",
      spec: typeof a.spec === "string" && a.spec ? a.spec : null,
      qty: typeof a.qty === "string" ? a.qty : "",
      priceMinor: typeof a.priceMinor === "number" ? a.priceMinor : null,
    };
  });
}

/** The machine's own figures, which the set row prints. */
function setRowOf(ctx: RenderContext): { qty: string; priceMinor: number } {
  const e = (ctx.equipment ?? {}) as Record<string, unknown>;
  return {
    // Only when more than one set is being quoted: "1" beside a set that is
    // obviously one set is noise on a letter.
    qty: typeof e.setQtyLabel === "string" ? e.setQtyLabel : "",
    priceMinor: typeof e.setPriceMinor === "number" ? e.setPriceMinor : 0,
  };
}

function priceOf(ctx: RenderContext): {
  goodsMinor: number;
  discountMinor: number;
  vatMinor: number;
} {
  const p = (ctx.price ?? {}) as Record<string, unknown>;
  return {
    goodsMinor: typeof p.goodsMinor === "number" ? p.goodsMinor : 0,
    discountMinor: typeof p.discountMinor === "number" ? p.discountMinor : 0,
    vatMinor: typeof p.vatMinor === "number" ? p.vatMinor : 0,
  };
}

export function EquipmentTableBlock({
  block,
  styles,
  ctx,
  kind,
  after,
}: TableBlockProps<"equipmentTable">) {
  const {
    captionLeft,
    captionRight,
    headings,
    setLabel,
    discountLabel,
    vatLabel,
    totalLabel,
    amountSuffix,
    showQty,
    showPrice,
    showTotal,
  } = block.props;

  const rows = rowsOf(ctx);
  const set = setRowOf(ctx);
  const price = priceOf(ctx);
  const money = (minor: number | null) =>
    minor == null ? "" : `${formatTaka(minor)}${amountSuffix}`;

  const qtyCell = showQty ? styles.offerQty : { width: 0 };
  const priceCell = showPrice ? styles.offerPrice : { width: 0 };

  const head = (
    <View style={styles.offerHead}>
      <Text style={[styles.offerName, styles.label]}>
        {interpolate(headings.no, ctx, kind)}
      </Text>
      {showQty ? (
        <Text style={[qtyCell, styles.label]}>
          {interpolate(headings.qty, ctx, kind)}
        </Text>
      ) : null}
      {showPrice ? (
        <Text style={[priceCell, styles.label]}>
          {interpolate(headings.price, ctx, kind)}
        </Text>
      ) : null}
    </View>
  );

  const setRow = (
    <View key="set" style={styles.offerRow}>
      <Text style={[styles.offerName, styles.label]}>
        {interpolate(setLabel, ctx, kind)}
      </Text>
      {showQty ? <Text style={qtyCell}>{set.qty}</Text> : null}
      {showPrice ? (
        <Text style={[priceCell, styles.label]}>
          {set.priceMinor > 0 ? money(set.priceMinor) : ""}
        </Text>
      ) : null}
    </View>
  );

  const accessoryRows = rows.map((r) => (
    <View key={`a${r.no}`} style={styles.offerRow}>
      <View style={styles.offerName}>
        <View style={{ flexDirection: "row" }}>
          <Text style={[styles.offerNo, styles.label]}>{r.no}.</Text>
          <Text style={[{ flex: 1 }, styles.label]}>{r.name}</Text>
        </View>
        {r.spec ? <Text style={styles.offerSpec}>{r.spec}</Text> : null}
      </View>
      {showQty ? <Text style={qtyCell}>{r.qty}</Text> : null}
      {showPrice ? <Text style={priceCell}>{money(r.priceMinor)}</Text> : null}
    </View>
  ));

  /**
   * A discount belongs inside the table, above the total.
   *
   * The rows add up to what the goods list at; the total is what is being
   * asked for them. Printing the difference anywhere else leaves a reader
   * to work out why the closing figure is not the sum of the column.
   */
  const discountRow =
    discountLabel && price.discountMinor > 0 && showPrice
      ? [
          <View key="discount" style={[styles.offerRow, styles.offerDeduct]}>
            <Text style={styles.offerName}>
              {interpolate(discountLabel, ctx, kind)}
            </Text>
            {showQty ? <Text style={qtyCell} /> : null}
            {/* No minus sign: the label says "Less", and the built-in PDF
                fonts have no U+2212 to print one with. */}
            <Text style={priceCell}>{money(price.discountMinor)}</Text>
          </View>,
        ]
      : [];

  /**
   * VAT, on the goods after the discount: its rate in the label, its figure
   * in the column. Only with a price column to put the figure in — a
   * document that states no money states no tax either.
   */
  const vatShown = Boolean(vatLabel) && price.vatMinor > 0 && showPrice;
  const vatRow = vatShown
    ? [
        <View
          key="vat"
          style={[
            styles.offerRow,
            // Directly under the discount it needs no air of its own.
            discountRow.length ? {} : styles.offerDeduct,
          ]}
        >
          <Text style={styles.offerName}>
            {interpolate(vatLabel ?? "", ctx, kind)}
          </Text>
          {showQty ? <Text style={qtyCell} /> : null}
          <Text style={priceCell}>{money(price.vatMinor)}</Text>
        </View>,
      ]
    : [];

  // What the client pays for the set: the goods, and the VAT when it is a
  // row of this table — otherwise the column would not add up to it.
  const totalMinor = price.goodsMinor + (vatShown ? price.vatMinor : 0);
  // The total row's own figure, for its label to spell out: `table.*` is
  // always the number printed beside it, whether or not the VAT row shows,
  // so a template can never print words that disagree with the figure.
  const totalCtx: RenderContext = {
    ...ctx,
    table: { totalMinor, totalInWords: amountInWords(totalMinor) },
  };
  const total = showTotal
    ? [
        <View key="total" style={[styles.offerRow, styles.offerTotal]}>
          <Text style={[styles.offerName, styles.label]}>
            {interpolate(totalLabel, totalCtx, kind)}
          </Text>
          {showQty ? <Text style={qtyCell} /> : null}
          {showPrice ? (
            <Text style={[priceCell, styles.label]}>{money(totalMinor)}</Text>
          ) : null}
        </View>,
      ]
    : [];

  return (
    <View style={frameStyle(block, styles)}>
      {captionLeft || captionRight ? (
        <View style={styles.offerCaption}>
          <Text style={{ flex: 1 }}>
            {captionLeft ? interpolate(captionLeft, ctx, kind) : ""}
          </Text>
          <Text style={styles.tdNum}>
            {captionRight ? interpolate(captionRight, ctx, kind) : ""}
          </Text>
        </View>
      ) : null}
      <PagedTable
        head={head}
        rows={[setRow, ...accessoryRows]}
        tail={[...discountRow, ...vatRow, ...total]}
        style={styles.offerTable}
        keepTogether={block.keepTogether}
        minPresenceAhead={block.minPresenceAhead}
        after={after}
      />
    </View>
  );
}
