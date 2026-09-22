import type {
  Block,
  BlockType,
  TemplateKind,
} from "@/lib/schemas/pdf-template";
import {
  FIXED_BLOCK_TYPES,
  OVERLAY_BLOCK_TYPES,
} from "@/lib/schemas/pdf-template";

/**
 * What the editor knows about each block type: a name, a line of help, and
 * how to make a fresh one. Client-safe.
 */
export type BlockInfo = {
  type: BlockType;
  label: string;
  description: string;
};

export const KIND_LABEL: Record<TemplateKind, string> = {
  proposal: "Proposal",
  invoice: "Sales invoice",
  challan: "Delivery challan",
  payslip: "Payslip",
  equipmentProposal: "Equipment proposal",
  equipmentInvoice: "Equipment invoice",
};

export const BLOCK_CATALOGUE: BlockInfo[] = [
  {
    type: "letterhead",
    label: "Letterhead",
    description:
      "Logo, contact column and the rule beneath; repeats on every page.",
  },
  {
    type: "watermark",
    label: "Watermark",
    description: "The pale dot motif down the right of the page.",
  },
  {
    type: "footerBand",
    label: "Footer band",
    description: "The coloured band across the foot of every page.",
  },
  {
    type: "title",
    label: "Title",
    description: "Centred, bold and underlined.",
  },
  {
    type: "heading",
    label: "Heading",
    description: "A bold run-in heading such as “Product/ Service Details”.",
  },
  { type: "paragraph", label: "Paragraph", description: "Plain running text." },
  {
    type: "labelledText",
    label: "Labelled text",
    description: "A bold label running into text: “Amount in Words: …”.",
  },
  {
    type: "metaColumns",
    label: "Header columns",
    description: "Side-by-side columns of “Label: value” lines.",
  },
  {
    type: "lineTable",
    label: "Line items table",
    description: "The ruled table of items, with optional totals inside it.",
  },
  {
    type: "equipmentTable",
    label: "Price offer table",
    description:
      "The machine, its numbered accessories and the total in words.",
  },
  {
    type: "labelledList",
    label: "Numbered terms",
    description: "Numbered “Label : value” rows with the values aligned.",
  },
  {
    type: "bullets",
    label: "Bullet list",
    description: "An optional heading over bulleted terms.",
  },
  {
    type: "keyValueList",
    label: "Label/value list",
    description:
      "An optional heading over “Label: value” lines — bank details.",
  },
  {
    type: "keyValueTable",
    label: "Label/value table",
    description: "A two-column ruled table of labels and figures.",
  },
  {
    type: "signOff",
    label: "Signature row",
    description:
      "Signature lines with their labels; never splits across pages.",
  },
  { type: "spacer", label: "Spacer", description: "Vertical space." },
  { type: "pageBreak", label: "Page break", description: "Start a new page." },
  {
    type: "stamp",
    label: "Stamp",
    description:
      "A seal, signature or name stamp, riding on the signature row or pinned to a spot on the page.",
  },
];

export const BLOCK_INFO: Record<BlockType, BlockInfo> = Object.fromEntries(
  BLOCK_CATALOGUE.map((b) => [b.type, b]),
) as Record<BlockType, BlockInfo>;

/** The flow types an admin can add; stationery exists once, stamps have their own list. */
export const ADDABLE_BLOCK_TYPES = BLOCK_CATALOGUE.filter(
  (b) => !FIXED_BLOCK_TYPES.has(b.type) && !OVERLAY_BLOCK_TYPES.has(b.type),
);

/** A one-line summary of a block for the list, from its own text. */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case "title":
    case "heading":
    case "paragraph":
      return block.props.text;
    case "labelledText":
      return `${block.props.label} ${block.props.text}`;
    case "metaColumns":
      return block.props.columns
        .map((c) => c.heading ?? c.fields[0]?.label ?? c.fields[0]?.value ?? "")
        .filter(Boolean)
        .join(" · ");
    case "lineTable":
      return `${block.props.columns.filter((c) => c.visible).length} columns${
        block.props.totals ? `, ${block.props.totals.rows.length} totals` : ""
      }`;
    case "equipmentTable":
      return block.props.setLabel;
    case "labelledList":
      return block.props.heading ?? `${block.props.items.length} terms`;
    case "bullets":
      return block.props.heading ?? `${block.props.items.length} items`;
    case "keyValueList":
      return block.props.heading ?? `${block.props.items.length} lines`;
    case "keyValueTable":
      return block.props.header?.label ?? `${block.props.rows.length} rows`;
    case "signOff":
      return [block.props.left, block.props.right].filter(Boolean).join(" · ");
    case "spacer":
      return `${block.props.height} pt`;
    case "footerBand":
      return block.props.text;
    case "letterhead":
      return `${block.props.lines.length} contact lines`;
    case "watermark":
      return `opacity ${block.props.opacity}`;
    case "pageBreak":
      return "";
    case "stamp":
      return block.props.anchor === "block"
        ? `attached · ${Math.round(block.props.x)}, ${Math.round(block.props.y)} pt`
        : `${Math.round(block.props.x)}, ${Math.round(block.props.y)} pt · ${block.props.pages}`;
  }
}

export function newBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

/**
 * A complete, schema-valid block of the given type, with sensible props.
 *
 * `existing` is the template's current blocks: a new stamp rides on the
 * signature row when there is one, because that is where a seal or signature
 * goes — a stamp pinned to a page spot looks right on a one-page sample and
 * then stays behind when a longer document carries the signature row onto
 * the next page.
 */
export function newBlock(
  type: BlockType,
  kind: TemplateKind,
  existing: Block[] = [],
): Block {
  const id = newBlockId();
  switch (type) {
    case "title":
      return { id, type, props: { text: "Title" } };
    case "heading":
      return {
        id,
        type,
        props: { text: "Heading", underline: true },
        style: { marginTop: 10 },
      };
    case "paragraph":
      return { id, type, props: { text: "Text" }, style: { marginTop: 8 } };
    case "labelledText":
      return {
        id,
        type,
        props: { label: "Label:", labelStyle: "bold", text: "Text" },
        style: { marginTop: 8 },
      };
    case "metaColumns":
      return {
        id,
        type,
        style: { marginTop: 8 },
        props: {
          gap: 24,
          lineGap: 1,
          columns: [
            {
              align: "left",
              fields: [
                { label: "Label:", value: "Value", hideWhenEmpty: false },
              ],
            },
            {
              heading: "Heading",
              align: "left",
              fields: [
                { label: "Label:", value: "Value", hideWhenEmpty: false },
              ],
            },
          ],
        },
      };
    case "lineTable":
      return {
        id,
        type,
        props: {
          columns: [
            {
              key: "sn",
              label: "S/N",
              weight: 0.4,
              align: "center",
              visible: true,
            },
            {
              key: "description",
              label: "Product",
              weight: 2.5,
              align: "center",
              visible: true,
            },
            {
              key: "brandOrigin",
              label: "Brand",
              weight: 1,
              align: "center",
              visible: true,
            },
            {
              key: "specification",
              label: "Specification",
              weight: 2.2,
              align: "center",
              visible: true,
            },
            {
              key: "qty",
              label: "Qty",
              weight: 0.55,
              align: "center",
              visible: true,
            },
            {
              key: "unit",
              label: "Unit",
              weight: 0.55,
              align: "center",
              visible: true,
              emptyText: "PCS",
            },
            {
              key: "unitPrice",
              label: "Unit Price\n(BDT)",
              weight: 1.05,
              align: "right",
              visible: true,
            },
            {
              key: "vat",
              label: "VAT\n(%/BDT)",
              weight: 1.35,
              align: "right",
              visible: true,
            },
            {
              key: "lineTotal",
              label: "Total Amount\n(BDT)",
              weight: 1.15,
              align: "right",
              visible: kind !== "challan",
            },
          ],
          vatColumn: "auto",
        },
      };
    case "equipmentTable":
      return {
        id,
        type,
        style: { marginTop: 10 },
        props: {
          captionLeft: "Price: BDT",
          captionRight: "Delivery: {{terms.deliveryScope}}",
          headings: { no: "NO", qty: "Qty", price: "Price" },
          setLabel: "{{equipment.setName}}",
          discountLabel: "Less discount",
          totalLabel: "Total Price BDT. {{price.goodsInWords}}",
          amountSuffix: "/=",
          showQty: true,
          showPrice: true,
          showTotal: true,
        },
      };
    case "labelledList":
      return {
        id,
        type,
        style: { marginTop: 10 },
        keepTogether: true,
        minPresenceAhead: 96,
        props: {
          heading: "Terms & Conditions:-",
          headingGap: 6,
          numbered: true,
          labelWidth: 150,
          separator: ":",
          items: [{ label: "Label", text: "Value", hideWhenEmpty: false }],
        },
      };
    case "bullets":
      return {
        id,
        type,
        style: { marginTop: 9 },
        keepTogether: true,
        minPresenceAhead: 96,
        props: {
          heading: "Terms & Condition:",
          headingGap: 5,
          items: ["First term"],
        },
      };
    case "keyValueList":
      return {
        id,
        type,
        style: { marginTop: 9 },
        keepTogether: true,
        props: {
          heading: "Heading:",
          headingGap: 5,
          items: [{ label: "Label:", value: "Value", hideWhenEmpty: false }],
        },
      };
    case "keyValueTable":
      return {
        id,
        type,
        props: {
          header: { label: "Item", value: "Amount (BDT)" },
          headerRule: "hairline",
          rows: [{ label: "Label", value: "Value", strong: false }],
        },
      };
    case "signOff":
      return {
        id,
        type,
        props: {
          left: "Approved By",
          right: "Received By",
          includeSignatory: false,
          labelAlign: "center",
        },
      };
    case "spacer":
      return { id, type, props: { height: 12 } };
    case "pageBreak":
      return { id, type, props: {} };
    case "letterhead":
      return {
        id,
        type,
        props: {
          showLogo: true,
          lines: [
            { icon: "phone", text: "{{company.phone}}" },
            { icon: "mail", text: "{{company.email}}" },
          ],
        },
      };
    case "watermark":
      return { id, type, props: { opacity: 0.09, width: 210, bleed: 26 } };
    case "footerBand":
      return {
        id,
        type,
        props: { text: "empowering healthcare", letterSpacing: 3 },
      };
    case "stamp": {
      const signOff = existing.find((b) => b.type === "signOff");
      // On the signature row when there is one — over the "Approved By" line,
      // where a pen would go — and otherwise bottom-left of the last page.
      // The editor's pad drags it from there either way.
      return signOff
        ? {
            id,
            type,
            props: {
              assetId: "",
              anchor: "block",
              blockId: signOff.id,
              x: 0,
              y: -30,
              width: 120,
              opacity: 1,
              pages: "last",
            },
          }
        : {
            id,
            type,
            props: {
              assetId: "",
              anchor: "page",
              x: 60,
              y: 700,
              width: 120,
              opacity: 1,
              pages: "last",
            },
          };
    }
  }
}
