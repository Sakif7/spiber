/* eslint-disable jsx-a11y/alt-text -- these are @react-pdf/renderer <Image> elements, not HTML images */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
  Circle,
} from "@react-pdf/renderer";
import { LEGAL, CONTACT, OFFICES } from "@/lib/contact";

/**
 * The company letterhead, shared by every generated document.
 *
 * Reproduces the printed stationery the client sent as samples: the teal bar
 * down the left edge, the wordmark, a contact column with circular icon badges
 * listing both offices, the two-tone rule beneath, and the "empowering
 * healthcare" band across the foot of the page.
 *
 * Deliberately NOT reproduced: the round company seal and the handwritten
 * signature that appear on the scans. A generated document carries the
 * signature LINE and the name; the seal and signature go on by hand, which is
 * the point of them.
 *
 * The built-in Times and Helvetica faces are used throughout — they need no
 * font files and are guaranteed to render, which matters for a document a
 * client receives. Note they have no ৳ glyph, so money prints as grouped
 * numbers under a "(BDT)" heading, exactly as the samples do.
 */

/** Sampled from the logo artwork so drawn bars match the wordmark exactly. */
const TEAL = "#20b0b0";
const INK = "#1a1a1a";
const MUTED = "#444444";
const RULE = "#000000";
/** Table header wash — the faintest teal that still separates the head row. */
const TINT = "#eaf7f7";

/** Page geometry, in points. A4 is 595 wide. */
const PAGE_PAD_X = 40;
const PAGE_PAD_TOP = 26;

export const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    // Room for the footer band, and no more: a short proposal has to fit on
    // one page the way the printed stationery does.
    paddingBottom: 52,
    paddingHorizontal: PAGE_PAD_X,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: INK,
  },

  /* ── letterhead ── */
  head: { position: "relative", flexDirection: "row" },
  edgeBar: {
    position: "absolute",
    left: -PAGE_PAD_X,
    top: -PAGE_PAD_TOP,
    width: 22,
    height: 118,
    backgroundColor: TEAL,
  },
  logoWrap: { justifyContent: "center", paddingTop: 6 },
  logo: { width: 190 },
  contact: { marginLeft: "auto", width: 232 },
  contactRow: { flexDirection: "row", marginBottom: 5 },
  contactIcon: { marginRight: 6, marginTop: 0.5 },
  contactText: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: INK,
    lineHeight: 1.35,
  },
  contactLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: INK },

  /* the rule under the letterhead: thick on the left, hairline to the edge */
  ruleRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  ruleThick: {
    marginLeft: -PAGE_PAD_X,
    width: 250,
    height: 7,
    backgroundColor: TEAL,
  },
  ruleThin: {
    flexGrow: 1,
    marginRight: -PAGE_PAD_X,
    height: 2,
    backgroundColor: TEAL,
  },

  /* ── body ── */
  title: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    textAlign: "center",
    textDecoration: "underline",
    marginTop: 12,
    marginBottom: 10,
  },
  label: { fontFamily: "Times-Bold" },
  underlineLabel: { fontFamily: "Times-Bold", textDecoration: "underline" },
  small: { fontSize: 10 },
  muted: { color: MUTED },
  section: { marginBottom: 10 },

  /* ── the templates' two-column header: our reference | the client ── */
  partyRow: { flexDirection: "row", gap: 24, marginTop: 8 },
  partyCol: { flex: 1 },
  partyHeading: {
    fontFamily: "Times-Bold",
    textDecoration: "underline",
    marginBottom: 3,
  },
  metaLine: { marginBottom: 1 },

  /* ── bulleted terms ── */
  bulletRow: { flexDirection: "row", marginBottom: 1.5 },
  bulletDot: { width: 14, textAlign: "center" },
  bulletText: { flex: 1, textAlign: "justify" },

  /* ── table ──
     Every cell is ruled, as on the samples. The refinements over the scan are
     deliberate and small: a tinted header, room to breathe, and figures set
     right so decimal places line up down the column. */
  table: { borderWidth: 1, borderColor: RULE },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: RULE },
  trLast: { flexDirection: "row" },
  th: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "center",
    backgroundColor: TINT,
    borderRightWidth: 1,
    borderColor: RULE,
  },
  td: {
    fontSize: 9.5,
    paddingVertical: 3,
    paddingHorizontal: 5,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: RULE,
  },
  /** Item description: reads far better ranged left than centred. */
  tdText: { textAlign: "left" },
  /** Money: ranged right so the columns of figures align. */
  tdNum: { textAlign: "right" },

  /* ── decoration ── */
  watermark: {
    position: "absolute",
    top: -PAGE_PAD_TOP,
    left: -PAGE_PAD_X,
    width: 595,
    height: 842,
  },

  /* ── footer band ── */
  footerBand: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: TEAL,
    paddingVertical: 7,
  },
  footerText: {
    color: "#ffffff",
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Helvetica",
    letterSpacing: 3,
  },

  /* ── signatures ── */
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  signBox: { width: 215 },
  signLine: { borderTopWidth: 1, borderColor: RULE, paddingTop: 4 },
});

/**
 * Read a bundled image once; a missing file must not break the document.
 *
 * react-pdf embeds whatever bytes it is given, so the 1024px site logo made
 * every generated PDF about 1.8 MB — for an image drawn 190pt wide, in a
 * document that gets emailed. Regenerate with `npm run make-pdf-assets`.
 */
const imageCache = new Map<string, Buffer | null>();
function publicImage(name: string): Buffer | null {
  if (imageCache.has(name)) return imageCache.get(name)!;
  for (const candidate of [path.join("pdf", name), name]) {
    try {
      const buf = fs.readFileSync(
        path.join(process.cwd(), "public", candidate),
      );
      imageCache.set(name, buf);
      return buf;
    } catch {
      // try the next candidate
    }
  }
  imageCache.set(name, null);
  return null;
}

/** One circular teal badge from the letterhead's contact column. */
function ContactIcon({ kind }: { kind: "phone" | "mail" | "web" | "place" }) {
  const glyph = {
    phone:
      "M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.2 2.2z",
    mail: "M3 6h18v12H3V6zm1.6 1.4L12 13l7.4-5.6",
    web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.4 3.6 5.4 3.6 9S14.4 18.6 12 21c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3z",
    place: "M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.6v-6H9.6v6H5a1 1 0 0 1-1-1z",
  }[kind];
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 11, height: 11 }}>
      <Circle cx="12" cy="12" r="11.5" fill={TEAL} />
      <Path
        d={glyph}
        stroke="#ffffff"
        strokeWidth={kind === "place" || kind === "phone" ? 0 : 1.6}
        fill={kind === "place" || kind === "phone" ? "#ffffff" : "none"}
      />
    </Svg>
  );
}

function ContactLine({
  kind,
  children,
}: {
  kind: "phone" | "mail" | "web" | "place";
  children: React.ReactNode;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <ContactIcon kind={kind} />
      </View>
      <View style={{ flexGrow: 1 }}>{children}</View>
    </View>
  );
}

export function Letterhead() {
  const logo = publicImage("letterhead-logo.png");
  const head = OFFICES[0];
  const regional = OFFICES[1];

  return (
    <View>
      <View style={styles.head}>
        <View style={styles.edgeBar} />
        <View style={styles.logoWrap}>
          {logo ? (
            <Image style={styles.logo} src={{ data: logo, format: "png" }} />
          ) : (
            <Text style={{ fontFamily: "Times-Bold", fontSize: 18 }}>
              {LEGAL.name}
            </Text>
          )}
        </View>

        <View style={styles.contact}>
          <ContactLine kind="phone">
            <Text style={styles.contactText}>{CONTACT.phone}</Text>
          </ContactLine>
          <ContactLine kind="mail">
            <Text style={styles.contactText}>{CONTACT.generalEmail}</Text>
          </ContactLine>
          <ContactLine kind="web">
            <Text style={styles.contactText}>www.spibermed.com</Text>
          </ContactLine>
          {head ? (
            <ContactLine kind="place">
              <Text style={styles.contactLabel}>Head Office:</Text>
              <Text style={styles.contactText}>{head.address.en}</Text>
            </ContactLine>
          ) : null}
          {regional ? (
            <ContactLine kind="place">
              <Text style={styles.contactLabel}>Regional Office:</Text>
              <Text style={styles.contactText}>{regional.address.en}</Text>
            </ContactLine>
          ) : null}
        </View>
      </View>

      <View style={styles.ruleRow}>
        <View style={styles.ruleThick} />
        <View style={styles.ruleThin} />
      </View>
    </View>
  );
}

/**
 * The pale dot motif the printed stationery carries down the right of the page.
 *
 * Same circles as the logo's cluster, blown up and dropped to a wash so they
 * sit behind the text. Rendered as the first child of a Page so everything
 * else paints over it, and `fixed` so it repeats on a second page.
 *
 * Coordinates are in points against the full A4 box, which is why the view is
 * pulled out to the page edges by the padding.
 */
const WATERMARK_DOTS: { cx: number; cy: number; r: number }[] = [
  { cx: 415, cy: 368, r: 24 },
  { cx: 545, cy: 520, r: 41 },
  { cx: 305, cy: 482, r: 19 },
  { cx: 423, cy: 612, r: 31 },
  { cx: 537, cy: 712, r: 33 },
  { cx: 500, cy: 300, r: 14 },
  { cx: 350, cy: 690, r: 12 },
  { cx: 575, cy: 620, r: 17 },
];

export function Watermark() {
  return (
    <View style={styles.watermark} fixed>
      <Svg viewBox="0 0 595 842" style={{ width: 595, height: 842 }}>
        {WATERMARK_DOTS.map((d, i) => (
          <Circle
            key={i}
            cx={String(d.cx)}
            cy={String(d.cy)}
            r={String(d.r)}
            fill={TEAL}
            fillOpacity={0.09}
          />
        ))}
      </Svg>
    </View>
  );
}

export function FooterBand() {
  return (
    <View style={styles.footerBand} fixed>
      <Text style={styles.footerText}>empowering healthcare</Text>
    </View>
  );
}

/**
 * The closing signature row.
 *
 * The templates label the left line "Approved By" and, on an invoice, add
 * "Received By" on the right. The signatory's name and role sit under the
 * left line, as they do on the documents the company actually sent — a bare
 * "Approved By" tells the reader nothing about who approved it.
 *
 * Space is left above each line for a real pen. No signature image and no seal
 * is ever drawn: those are what make the paper copy the original.
 */
export function SignOffRow({
  left,
  right,
  signatory,
}: {
  left: string;
  right?: string;
  signatory?: { name: string; title: string; phone?: string; email?: string };
}) {
  return (
    <View style={styles.signRow} wrap={false}>
      <View style={styles.signBox}>
        <View style={{ height: 26 }} />
        <View style={styles.signLine}>
          <Text style={[styles.small, styles.label]}>{left}</Text>
          {signatory ? (
            <>
              <Text style={styles.small}>{signatory.name}</Text>
              <Text style={styles.small}>{signatory.title}</Text>
              <Text style={styles.small}>{LEGAL.name}</Text>
              {signatory.phone ? (
                <Text style={styles.small}>Contact: {signatory.phone}</Text>
              ) : null}
              {signatory.email ? (
                <Text style={styles.small}>E-mail: {signatory.email}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      {right ? (
        <View style={styles.signBox}>
          <View style={{ height: 26 }} />
          <View style={styles.signLine}>
            <Text style={[styles.small, styles.label]}>{right}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
