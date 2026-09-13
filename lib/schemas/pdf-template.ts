import { z } from "zod";

/**
 * A PDF template: the theme and the ordered blocks that make up one of the
 * company's printed documents.
 *
 * This file is imported by the admin editor (a client component), so it must
 * stay free of anything server-side — no renderer, no models. The block
 * catalogue is deliberately small: each type is one of the primitives the
 * hand-written documents were already built from, parameterised, so any
 * layout the old code could draw is expressible here and the built-in
 * defaults reproduce it exactly.
 *
 * Text props may carry `{{path}}` placeholders resolved against the document's
 * render context (see `lib/pdf/engine/paths.ts` for what each kind offers).
 */

export const templateKindSchema = z.enum([
  "proposal",
  "invoice",
  "challan",
  "payslip",
]);
export type TemplateKind = z.infer<typeof templateKindSchema>;
export const TEMPLATE_KINDS = templateKindSchema.options;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex colour like #20b0b0");
const pt = (min: number, max: number) => z.number().min(min).max(max);

/** Every visual token the old stylesheet hard-coded. */
export const themeSchema = z.object({
  colors: z.object({
    accent: hex.default("#20b0b0"),
    ink: hex.default("#1a1a1a"),
    muted: hex.default("#444444"),
    rule: hex.default("#000000"),
    hairline: hex.default("#9a9a9a"),
    tint: hex.default("#eaf7f7"),
  }),
  page: z.object({
    padX: pt(20, 80).default(40),
    padTop: pt(10, 80).default(26),
    padBottom: pt(30, 120).default(52),
  }),
  font: z.object({
    body: z.enum(["Times", "Helvetica"]).default("Times"),
    size: pt(8, 14).default(10.5),
    tableSize: pt(7, 13).default(9.5),
  }),
});
export type Theme = z.infer<typeof themeSchema>;

/** The only per-block style knobs the editor exposes. */
export const blockStyleSchema = z.object({
  marginTop: pt(0, 120).optional(),
  marginBottom: pt(0, 120).optional(),
  fontSize: pt(6, 24).optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  muted: z.boolean().optional(),
});
export type BlockStyle = z.infer<typeof blockStyleSchema>;

/** A text that may carry `{{path}}` placeholders. */
const text = z.string().max(2000);
/**
 * A context path such as `totals.subtotalMinor`; a leading `!` negates it
 * where a condition is expected. Restricted so a walk can never reach
 * `__proto__` or the like.
 */
export const contextPathSchema = z
  .string()
  .regex(/^!?[a-zA-Z][\w.]*$/, "a field path like totals.subtotalMinor")
  .max(80);

const base = z.object({
  id: z.string().min(1).max(40),
  hidden: z.boolean().optional(),
  /** Render only when this context path is truthy; "!" negates. */
  showIf: contextPathSchema.optional(),
  style: blockStyleSchema.optional(),
  /** react-pdf `wrap={false}`: never split the block across pages. */
  keepTogether: z.boolean().optional(),
  /** react-pdf `minPresenceAhead`: push to the next page unless this much fits. */
  minPresenceAhead: pt(0, 400).optional(),
});

export const metaFieldSchema = z.object({
  /** Set in bold with a trailing space, as "Invoice No: …" prints. */
  label: text.optional(),
  value: text,
  /** Hide the line when every placeholder in `value` resolves to nothing. */
  hideWhenEmpty: z.boolean().default(true),
  bold: z.boolean().optional(),
  small: z.boolean().optional(),
});
export type MetaField = z.infer<typeof metaFieldSchema>;

export const lineColumnKeySchema = z.enum([
  "sn",
  "description",
  "brandOrigin",
  "specification",
  "qty",
  "unit",
  "unitPrice",
  "vat",
  "lineTotal",
]);
export type LineColumnKey = z.infer<typeof lineColumnKeySchema>;

export const lineColumnSchema = z.object({
  key: lineColumnKeySchema,
  /** May contain "\n" for a two-line heading. */
  label: z.string().max(60),
  /** Flex weight relative to the other columns. */
  weight: z.number().min(0.2).max(6),
  align: z.enum(["left", "center", "right"]).default("center"),
  visible: z.boolean().default(true),
  /** Printed when the line has no value — "PCS" for a missing unit. */
  emptyText: z.string().max(20).optional(),
});
export type LineColumn = z.infer<typeof lineColumnSchema>;

export const totalsRowSchema = z.object({
  id: z.string().min(1).max(40),
  label: text,
  /** Context path of the figure, e.g. `totals.subtotalMinor`. */
  path: contextPathSchema,
  hideWhenZero: z.boolean().default(false),
  /** Tinted and bold: the figure the reader came for. */
  emphasis: z.boolean().default(false),
  /** Printed before the figure — "−" on a discount. */
  prefix: z.string().max(4).optional(),
  valueAlign: z.enum(["right", "center"]).default("right"),
});
export type TotalsRow = z.infer<typeof totalsRowSchema>;

/**
 * One figure on the column-aligned totals line, printed directly under the
 * column it names — the quantity total under Qty, the subtotal under the
 * amount column — rather than in the stack's single figure cell.
 */
export const columnTotalCellSchema = z.object({
  column: lineColumnKeySchema,
  path: contextPathSchema,
  /** Tinted and bold. */
  emphasis: z.boolean().default(false),
});
export type ColumnTotalCell = z.infer<typeof columnTotalCellSchema>;

/**
 * A totals line that keeps the columns.
 *
 * The first row after the items: each cell listed carries its figure under
 * its own column, the empty run before the first of them carries the label,
 * and the other empty columns merge into single cells so the line does not
 * read as a row of boxes. The stacked rows follow beneath it.
 */
export const columnTotalsSchema = z.object({
  label: text,
  cells: z.array(columnTotalCellSchema).min(1).max(9),
});
export type ColumnTotals = z.infer<typeof columnTotalsSchema>;

const stationery = {
  letterhead: base.extend({
    type: z.literal("letterhead"),
    props: z.object({
      showLogo: z.boolean().default(true),
      lines: z
        .array(
          z.object({
            icon: z.enum(["phone", "mail", "web", "place"]),
            label: z.string().max(40).optional(),
            text,
          }),
        )
        .max(8),
    }),
  }),
  watermark: base.extend({
    type: z.literal("watermark"),
    props: z.object({
      opacity: z.number().min(0).max(0.5).default(0.09),
      width: pt(60, 400).default(210),
      bleed: pt(0, 100).default(26),
    }),
  }),
  footerBand: base.extend({
    type: z.literal("footerBand"),
    props: z.object({
      text: z.string().max(80),
      letterSpacing: pt(0, 10).default(3),
    }),
  }),
};

export const blockSchema = z.discriminatedUnion("type", [
  stationery.letterhead,
  stationery.watermark,
  stationery.footerBand,

  base.extend({ type: z.literal("title"), props: z.object({ text }) }),
  base.extend({
    type: z.literal("heading"),
    props: z.object({ text, underline: z.boolean().default(true) }),
  }),
  base.extend({ type: z.literal("paragraph"), props: z.object({ text }) }),
  base.extend({
    type: z.literal("labelledText"),
    props: z.object({
      label: text,
      labelStyle: z.enum(["bold", "underline"]).default("bold"),
      text,
    }),
  }),
  base.extend({
    type: z.literal("metaColumns"),
    props: z.object({
      gap: pt(0, 60).default(24),
      /** Space under each line; the party blocks use 1, the payslip 0. */
      lineGap: pt(0, 12).default(1),
      columns: z
        .array(
          z.object({
            heading: z.string().max(60).optional(),
            align: z.enum(["left", "right"]).default("left"),
            fields: z.array(metaFieldSchema).max(12),
          }),
        )
        .min(1)
        .max(3),
    }),
  }),
  base.extend({
    type: z.literal("lineTable"),
    props: z.object({
      columns: z.array(lineColumnSchema).min(1).max(9),
      /** "auto" shows the VAT column only when the lines' rates differ. */
      vatColumn: z.enum(["auto", "always", "never"]).default("auto"),
      totals: z
        .object({
          /** Columns merged into the label cell of every totals row. */
          labelColumns: z.array(lineColumnKeySchema).min(1),
          /** Columns merged into the figure cell. */
          valueColumns: z.array(lineColumnKeySchema).min(1),
          rows: z.array(totalsRowSchema).max(12),
          /** A line under the columns, above the stack. See its schema. */
          columnTotals: columnTotalsSchema.optional(),
        })
        .optional(),
    }),
  }),
  base.extend({
    type: z.literal("bullets"),
    props: z.object({
      heading: text.optional(),
      headingGap: pt(0, 20).default(6),
      items: z.array(text).max(20),
    }),
  }),
  base.extend({
    type: z.literal("keyValueList"),
    props: z.object({
      heading: text.optional(),
      headingGap: pt(0, 20).default(5),
      items: z
        .array(
          z.object({
            label: text,
            value: text,
            hideWhenEmpty: z.boolean().default(false),
          }),
        )
        .max(20),
    }),
  }),
  base.extend({
    type: z.literal("keyValueTable"),
    props: z.object({
      header: z
        .object({ label: z.string().max(40), value: z.string().max(40) })
        .optional(),
      headerRule: z.enum(["full", "hairline"]).default("hairline"),
      rows: z
        .array(
          z.object({
            label: text,
            value: text,
            strong: z.boolean().default(false),
            showIf: contextPathSchema.optional(),
          }),
        )
        .max(20),
    }),
  }),
  base.extend({
    type: z.literal("signOff"),
    props: z.object({
      left: z.string().max(40),
      right: z.string().max(40).optional(),
      /** Print the signatory's name and title under the left line. */
      includeSignatory: z.boolean().default(false),
      /**
       * Where "Approved By" sits under its rule. Centred is the built-in look;
       * ranged left lines the label up with the signatory's name beneath it,
       * which is how the company's own proposals were laid out.
       */
      labelAlign: z.enum(["center", "left"]).default("center"),
    }),
  }),
  base.extend({
    type: z.literal("spacer"),
    props: z.object({ height: pt(1, 200) }),
  }),
  base.extend({ type: z.literal("pageBreak"), props: z.object({}) }),

  /**
   * An uploaded image — seal, signature, name stamp — placed at a fixed spot
   * on the sheet, painted over everything else. Coordinates are points from
   * the sheet's top-left corner (A4 = 595 × 842), independent of the margins.
   */
  base.extend({
    type: z.literal("stamp"),
    props: z.object({
      /** `PdfAsset` id; empty until one is chosen, and then prints nothing. */
      assetId: z.string().max(40),
      /**
       * `page`: x/y are measured from the sheet's top-left and the stamp
       * prints on the chosen pages. `block`: x/y are offsets from the
       * top-left of `blockId` and the stamp travels with that block wherever
       * pagination puts it — a signature on the signature row.
       */
      anchor: z.enum(["page", "block"]).default("page"),
      blockId: z.string().max(40).optional(),
      x: pt(-400, 595),
      y: pt(-400, 842),
      width: pt(10, 500),
      opacity: z.number().min(0.05).max(1).default(1),
      pages: z.enum(["all", "first", "last"]).default("last"),
    }),
  }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

/** Stationery repeats on every page and is painted in a fixed order. */
export const FIXED_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "watermark",
  "letterhead",
  "footerBand",
]);

/** Overlays sit at fixed coordinates over the page, so they are never in the flow. */
export const OVERLAY_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "stamp",
]);

/** A4, in points. */
export const PAGE_WIDTH_PT = 595;
export const PAGE_HEIGHT_PT = 842;

/** Every stamp asset a template refers to. */
export function stampAssetIds(t: { blocks: Block[] }): string[] {
  const ids = new Set<string>();
  for (const b of t.blocks) {
    if (b.type === "stamp" && b.props.assetId) ids.add(b.props.assetId);
  }
  return [...ids];
}

export const MAX_TEMPLATE_BYTES = 200_000;

export const templateDocSchema = z
  .object({
    /** The PDF's metadata title, e.g. "Sales Invoice {{invoiceNumber}}". */
    documentTitle: text,
    theme: themeSchema,
    blocks: z.array(blockSchema).max(60),
  })
  .superRefine((t, ctx) => {
    const ids = new Set<string>();
    for (const b of t.blocks) {
      if (ids.has(b.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate block id ${b.id}`,
          path: ["blocks"],
        });
      }
      ids.add(b.id);
    }
    if (JSON.stringify(t).length > MAX_TEMPLATE_BYTES) {
      ctx.addIssue({ code: "custom", message: "template too large" });
    }
  });
export type TemplateDoc = z.infer<typeof templateDocSchema>;

export const publishInputSchema = z.object({
  note: z.string().trim().max(200).optional(),
});
export const previewInputSchema = z.object({
  kind: templateKindSchema,
  template: templateDocSchema,
});
