/* eslint-disable jsx-a11y/alt-text -- these are @react-pdf/renderer <Image> elements, not HTML images */
import React from "react";
import { Text, View, Image, Svg, Path, Circle, G } from "@react-pdf/renderer";
import { publicImage } from "../assets";
import { interpolate } from "../resolve";
import type { BlockProps } from "./shared";

/**
 * The company stationery: what repeats on every page.
 *
 * Reproduces the printed letterhead the client sent as samples: the teal bar
 * down the left edge, the wordmark, a contact column with circular icon badges
 * listing both offices, the two-tone rule beneath, the pale dot motif down the
 * right of the page and the "empowering healthcare" band across the foot.
 *
 * All three are `fixed`, so they repeat: this is stationery, and a second page
 * of a proposal on blank paper is not the company's letterhead.
 *
 * Deliberately NOT reproduced: the round company seal and the handwritten
 * signature that appear on the scans. A generated document carries the
 * signature LINE and the name; the seal and signature go on by hand, which is
 * the point of them.
 */

/**
 * One circular badge from the letterhead's contact column.
 *
 * The glyphs are drawn stroked inside a scaled group rather than as one
 * hand-written path: the previous phone and office marks relied on an implicit
 * lineto after a moveto ("M4 11.2 12 4l…"), which this renderer resolves
 * differently from a browser — the office mark came out as an arch and the
 * phone as a blob. Every command below is explicit, and every shape is one the
 * renderer draws the same way at any size.
 */
const GLYPHS: Record<string, string[]> = {
  phone: [
    "M7 3 L11 3 L12.5 8 L10 9.5 C11 12 12 13 14.5 14 L16 11.5 L21 13 L21 17 C21 19 19.5 20.5 17.5 20.3 C10 19.5 4.5 14 3.7 6.5 C3.5 4.5 5 3 7 3 Z",
  ],
  mail: ["M3 6 L21 6 L21 18 L3 18 Z", "M3 6 L12 13 L21 6"],
  web: [
    "M12 3 C16.9 3 21 7.1 21 12 C21 16.9 16.9 21 12 21 C7.1 21 3 16.9 3 12 C3 7.1 7.1 3 12 3 Z",
    "M3 12 L21 12",
    "M12 3 C15 6.5 15 17.5 12 21 C9 17.5 9 6.5 12 3 Z",
  ],
  place: [
    "M12 2.5 C16 2.5 19 5.5 19 9.5 C19 14.5 12 21.5 12 21.5 C12 21.5 5 14.5 5 9.5 C5 5.5 8 2.5 12 2.5 Z",
    "M12 7 C13.4 7 14.5 8.1 14.5 9.5 C14.5 10.9 13.4 12 12 12 C10.6 12 9.5 10.9 9.5 9.5 C9.5 8.1 10.6 7 12 7 Z",
  ],
};

function ContactIcon({ kind, accent }: { kind: string; accent: string }) {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}>
      <Circle
        cx="12"
        cy="12"
        r="11"
        fill="#ffffff"
        stroke={accent}
        strokeWidth={1.6}
      />
      {/* The 24-unit glyph, brought down to sit inside the ring. */}
      <G transform="translate(5.4 5.4) scale(0.55)">
        {(GLYPHS[kind] ?? []).map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={accent}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}

export function LetterheadBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"letterhead">) {
  const logo = block.props.showLogo ? publicImage("letterhead-logo.png") : null;
  const accent = styles.edgeBar.backgroundColor as string;

  return (
    <View fixed>
      <View style={styles.head}>
        <View style={styles.edgeBar} />
        <View style={styles.logoWrap}>
          {logo ? (
            <Image style={styles.logo} src={{ data: logo, format: "png" }} />
          ) : (
            <Text style={styles.logoFallback}>{ctx.company.name}</Text>
          )}
        </View>

        <View style={styles.contact}>
          {block.props.lines.map((line, i) => (
            <View key={i} style={styles.contactRow}>
              <View style={styles.contactIcon}>
                <ContactIcon kind={line.icon} accent={accent} />
              </View>
              <View style={{ flex: 1 }}>
                {line.label ? (
                  <Text style={styles.contactLabel}>{line.label}</Text>
                ) : null}
                <Text style={styles.contactText}>
                  {interpolate(line.text, ctx, kind)}
                </Text>
              </View>
            </View>
          ))}
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
 * The logo's own dot cluster, cut down its middle and only the LEFT half
 * kept — the client marked that cut on the artwork. Blown up and dropped to a
 * wash so it sits behind the text, with the cut edge running off the right of
 * the page so the pattern reads as continuing past it.
 *
 * Measured off `letterhead-logo.png` and normalised so the motif can be drawn
 * at any size: x runs from the outer edge toward the cut, y from the top of
 * the cluster, and r is a fraction of the half's width. Kept as circles rather
 * than an upscaled crop, which at this size would be visibly soft.
 */
const WATERMARK_DOTS: { x: number; y: number; r: number }[] = [
  { x: 0.6705, y: 0.0696, r: 0.1676 },
  { x: 0.1371, y: 0.2911, r: 0.1371 },
  { x: 0.6705, y: 0.5032, r: 0.1714 },
  { x: 0.1524, y: 0.712, r: 0.141 },
  { x: 0.6705, y: 0.9304, r: 0.1676 },
];
/** Height of that half, as a multiple of its width. */
const WATERMARK_ASPECT = 2.4076;

export function WatermarkBlock({ block, styles }: BlockProps<"watermark">) {
  const w = block.props.width;
  const h = w * WATERMARK_ASPECT;
  const x0 = 595 + block.props.bleed - w;
  const y0 = (842 - h) / 2;
  const accent = styles.edgeBar.backgroundColor as string;

  return (
    <View style={styles.watermark} fixed>
      <Svg viewBox="0 0 595 842" style={{ width: 595, height: 842 }}>
        {WATERMARK_DOTS.map((d, i) => (
          <Circle
            key={i}
            cx={String(x0 + d.x * w)}
            cy={String(y0 + d.y * h)}
            r={String(d.r * w)}
            fill={accent}
            fillOpacity={block.props.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}

export function FooterBandBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"footerBand">) {
  return (
    <View style={styles.footerBand} fixed>
      <Text
        style={[
          styles.footerText,
          { letterSpacing: block.props.letterSpacing },
        ]}
      >
        {interpolate(block.props.text, ctx, kind)}
      </Text>
    </View>
  );
}
