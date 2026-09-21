import type {
  Block,
  BlockOf,
  LineColumn,
  LineColumnKey,
  MetaField,
  TemplateDoc,
  TemplateKind,
  Theme,
  TotalsRow,
} from "@/lib/schemas/pdf-template";

/**
 * The built-in templates: the company's documents as they were hand-coded,
 * expressed as blocks.
 *
 * These are what renders until a super-admin publishes a template of their
 * own, and what every document generated before templates existed re-renders
 * with — so they must stay exactly what the old code drew. Structure, field
 * set and wording come from the company's own Word templates; the styling
 * from the scanned PDFs of documents they actually sent.
 *
 * Client-safe: the editor loads these for "Reset to built-in".
 */

export const DEFAULT_THEME: Theme = {
  colors: {
    /** Sampled from the logo artwork so drawn bars match the wordmark. */
    accent: "#20b0b0",
    ink: "#1a1a1a",
    muted: "#444444",
    rule: "#000000",
    /** Between cells: present, but not competing with the numbers. */
    hairline: "#9a9a9a",
    /** Table header wash — the faintest teal that still separates the head. */
    tint: "#eaf7f7",
  },
  page: { padX: 40, padTop: 26, padBottom: 52 },
  font: { body: "Times", size: 10.5, tableSize: 9.5 },
};

/* ── helpers that fill in every schema default, so the objects are complete ── */

const field = (
  label: string | undefined,
  value: string,
  opts: Partial<MetaField> = {},
): MetaField => ({
  label,
  value,
  hideWhenEmpty: true,
  ...opts,
});

const column = (
  key: LineColumnKey,
  label: string,
  weight: number,
  opts: Partial<LineColumn> = {},
): LineColumn => ({
  key,
  label,
  weight,
  align: "center",
  visible: true,
  ...opts,
});

const totalsRow = (
  id: string,
  label: string,
  path: string,
  opts: Partial<TotalsRow> = {},
): TotalsRow => ({
  id,
  label,
  path,
  hideWhenZero: false,
  emphasis: false,
  valueAlign: "right",
  ...opts,
});

const stationery = (): Block[] => [
  {
    id: "watermark",
    type: "watermark",
    props: { opacity: 0.09, width: 210, bleed: 26 },
  },
  {
    id: "letterhead",
    type: "letterhead",
    props: {
      showLogo: true,
      lines: [
        { icon: "phone", text: "{{company.phone}}" },
        { icon: "mail", text: "{{company.email}}" },
        { icon: "web", text: "{{company.website}}" },
        {
          icon: "place",
          label: "Head Office:",
          text: "{{company.headOfficeAddress}}",
        },
        {
          icon: "place",
          label: "Regional Office:",
          text: "{{company.regionalOfficeAddress}}",
        },
      ],
    },
  },
  {
    id: "footer",
    type: "footerBand",
    props: { text: "empowering healthcare", letterSpacing: 3 },
  },
];

/** The eight columns the proposal and the invoice share. */
const SHARED_COLUMNS = (): LineColumn[] => [
  column("sn", "S/N", 0.4),
  column("description", "Product", 2.5),
  column("brandOrigin", "Brand", 1.0),
  column("specification", "Specification", 2.2),
  column("qty", "Qty", 0.55),
  column("unit", "Unit", 0.55, { emptyText: "PCS" }),
  column("unitPrice", "Unit Price\n(BDT)", 1.05, { align: "right" }),
  // Wider than the money columns: it carries a rate and an amount together.
  column("vat", "VAT\n(%/BDT)", 1.35, { align: "right" }),
  column("lineTotal", "Total Amount\n(BDT)", 1.15, { align: "right" }),
];

const detailsHeading = (
  id: string,
  style: BlockOf<"heading">["style"],
): BlockOf<"heading"> => ({
  id,
  type: "heading",
  props: { text: "Product/ Service Details", underline: true },
  style,
});

const returnsTerm =
  "Any malfunctioning and mismatched products those need to be returned, you should contact us within 3 days after the delivery of the products.";

/* ─────────────────────────────── proposal ─────────────────────────────── */

const proposal: TemplateDoc = {
  documentTitle: "Commercial Proposal {{proposalNo}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    {
      id: "title",
      type: "title",
      props: { text: "Commercial Proposal" },
    },
    {
      // Our reference on the left, theirs on the right.
      id: "header",
      type: "metaColumns",
      style: { marginTop: 8 },
      props: {
        gap: 24,
        lineGap: 1,
        columns: [
          {
            align: "left",
            fields: [
              field("Proposal No:", "{{proposalNo}}", { hideWhenEmpty: false }),
              field("Date:", "{{date}}", { hideWhenEmpty: false }),
              field(
                "Validity:",
                "{{terms.validityDays}} days from submission",
                {
                  hideWhenEmpty: false,
                },
              ),
            ],
          },
          {
            heading: "Proposal To",
            align: "left",
            fields: [
              field("Client:", "{{to.organisation}}", { hideWhenEmpty: false }),
              field("Department:", "{{to.department}}"),
              field("Address:", "{{to.address}}", { hideWhenEmpty: false }),
              field("Contact Person:", "{{to.attention}}"),
              field("Contact:", "{{to.phone}}"),
              field("E-mail:", "{{to.email}}"),
            ],
          },
        ],
      },
    },
    {
      id: "subject",
      type: "heading",
      props: { text: "Subject: {{subject}}", underline: true },
      style: { marginTop: 14 },
    },
    {
      id: "greeting",
      type: "paragraph",
      props: { text: "Dear Sir/Madam," },
      style: { marginTop: 12 },
    },
    {
      id: "intro",
      type: "paragraph",
      props: { text: "{{intro}}" },
      style: { marginTop: 8, marginBottom: 10, align: "justify" },
    },
    detailsHeading("details", { marginBottom: 6 }),
    {
      // Quotes a price per piece, so a "total" beside a quantity of one would
      // only repeat the figure to its left: the last column stays off.
      id: "table",
      type: "lineTable",
      props: {
        columns: SHARED_COLUMNS().map((c) =>
          c.key === "lineTotal" ? { ...c, visible: false } : c,
        ),
        vatColumn: "auto",
      },
    },
    {
      id: "terms",
      type: "bullets",
      style: { marginTop: 16 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Terms & Conditions:",
        headingGap: 6,
        items: [
          "Price Offer Validity: {{terms.validityDays}} Days after submission of the proposal",
          "Delivery: Within {{terms.deliveryDays}} working days after getting the work order at the clients premises",
          "Competitive Institutional Pricing",
          "After Sales Service (If Applicable)",
          "Dedicated Corporate/Institutional Support",
        ],
      },
    },
    {
      id: "signoff",
      type: "signOff",
      props: {
        left: "Approved By",
        includeSignatory: true,
        labelAlign: "center",
      },
    },
  ],
};

/* ─────────────────────────────── invoice ─────────────────────────────── */

const invoice: TemplateDoc = {
  documentTitle: "Sales Invoice {{invoiceNumber}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    { id: "title", type: "title", props: { text: "Sales Invoice" } },
    {
      id: "header",
      type: "metaColumns",
      style: { marginTop: 8 },
      props: {
        gap: 24,
        lineGap: 1,
        columns: [
          {
            align: "left",
            fields: [
              field("Invoice No:", "{{invoiceNumber}}", {
                hideWhenEmpty: false,
              }),
              field("Date:", "{{invoiceDate}}", { hideWhenEmpty: false }),
              field("Payment Due:", "{{paymentDue}}", { hideWhenEmpty: false }),
              field("Customer ID:", "{{customerId}}"),
              field("Reference/PO No:", "{{referenceNo}}"),
              field("Date of Delivery:", "{{deliveryDate}}"),
              field("BIN:", "{{company.bin}}", { hideWhenEmpty: false }),
            ],
          },
          {
            heading: "Bill To",
            align: "left",
            fields: [
              field("Client Name:", "{{billTo.organisation}}", {
                hideWhenEmpty: false,
              }),
              field("Address:", "{{billTo.address}}", { hideWhenEmpty: false }),
              field("Contact Person:", "{{billTo.contactPerson}}"),
              field("Phone:", "{{billTo.phone}}"),
              field("Email:", "{{billTo.email}}"),
            ],
          },
        ],
      },
    },
    detailsHeading("details", { marginTop: 14, marginBottom: 6 }),
    {
      id: "table",
      type: "lineTable",
      props: {
        columns: SHARED_COLUMNS(),
        vatColumn: "auto",
        // The template's totals stack. Discount, VAT and Transport appear
        // only when actually charged, so a plain invoice reads exactly like
        // the scanned one.
        totals: {
          labelColumns: ["qty", "unit", "unitPrice", "vat"],
          valueColumns: ["lineTotal"],
          rows: [
            totalsRow("qty", "Total Qty", "totals.totalQty", {
              valueAlign: "center",
            }),
            totalsRow("subtotal", "Subtotal", "totals.subtotalMinor"),
            totalsRow("discount", "Discount", "totals.discountMinor", {
              hideWhenZero: true,
              prefix: "−",
            }),
            // With a VAT column the rate differs line by line, so naming one
            // rate here would contradict the table above it: the suffix is
            // empty in that case.
            totalsRow("vat", "VAT{{vat.rateSuffix}}", "totals.vatMinor", {
              hideWhenZero: true,
            }),
            totalsRow(
              "delivery",
              "Transport/ Delivery",
              "totals.deliveryMinor",
              {
                hideWhenZero: true,
              },
            ),
            totalsRow("total", "Grand Total", "totals.grandTotalMinor", {
              emphasis: true,
            }),
            totalsRow("paid", "Paid", "totals.paidMinor", {
              hideWhenZero: true,
            }),
            totalsRow(
              "balance",
              "Balance Due/ Outstanding",
              "totals.balanceMinor",
              {
                emphasis: true,
              },
            ),
          ],
        },
      },
    },
    {
      id: "words",
      type: "labelledText",
      style: { marginTop: 8 },
      props: {
        label: "Amount in Words:",
        labelStyle: "underline",
        text: "{{totals.amountInWords}}",
      },
    },
    {
      // Stated, never charged. The client deducts this from the payment and
      // pays it to the NBR on our behalf, so it is not part of the total —
      // saying so on the invoice is what stops it being paid twice.
      id: "ait",
      type: "labelledText",
      showIf: "ait.amountMinor",
      style: { marginTop: 5, fontSize: 10 },
      props: {
        label: "AIT ({{ait.ratePercent}}%):",
        labelStyle: "bold",
        text: "{{ait.amountMinor}} — deductible at source and NOT included in the total above.",
      },
    },
    {
      id: "bank",
      type: "keyValueList",
      style: { marginTop: 9 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Payment Information:",
        headingGap: 5,
        items: [
          {
            label: "Bank Name:",
            value: "{{bank.bankName}}",
            hideWhenEmpty: false,
          },
          {
            label: "Account Name:",
            value: "{{bank.accountName}}",
            hideWhenEmpty: false,
          },
          {
            label: "Account No:",
            value: "{{bank.accountNo}}",
            hideWhenEmpty: false,
          },
          { label: "Branch:", value: "{{bank.branch}}", hideWhenEmpty: false },
          {
            label: "Routing No:",
            value: "{{bank.routingNo}}",
            hideWhenEmpty: false,
          },
          {
            label: "Mobile Finance Service:",
            value: "{{bank.mobileFinance}}",
            hideWhenEmpty: false,
          },
        ],
      },
    },
    {
      id: "terms",
      type: "bullets",
      style: { marginTop: 9 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Terms & Condition:",
        headingGap: 5,
        items: [
          "Payment Terms: Payment due within {{terms.paymentDays}} days of this invoice.",
          "If Advance Income Tax (AIT)/Tax Deducted at Source (TDS) is deducted under the applicable Income Tax laws, kindly provide the prescribed withholding tax certificate to {{company.name}}.",
          returnsTerm,
        ],
      },
    },
    {
      id: "signoff",
      type: "signOff",
      props: {
        left: "Approved By",
        right: "Received By",
        includeSignatory: false,
        labelAlign: "center",
      },
    },
  ],
};

/* ─────────────────────────────── challan ─────────────────────────────── */

/**
 * The note that travels with the goods: laid out as the invoice is, with
 * every trace of money taken out. Qty and Unit take the width the prices gave
 * up rather than leaving a gap, so the page does not read as an invoice
 * someone cut a hole in.
 */
const challan: TemplateDoc = {
  documentTitle: "Delivery Challan {{challanNumber}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    { id: "title", type: "title", props: { text: "Delivery Challan" } },
    {
      id: "header",
      type: "metaColumns",
      style: { marginTop: 8 },
      props: {
        gap: 24,
        lineGap: 1,
        columns: [
          {
            align: "left",
            fields: [
              field("Challan No:", "{{challanNumber}}", {
                hideWhenEmpty: false,
              }),
              field("Date:", "{{date}}", { hideWhenEmpty: false }),
              field("Against Invoice:", "{{invoiceNumber}}"),
              field("Reference/PO No:", "{{referenceNo}}"),
              field("BIN:", "{{company.bin}}", { hideWhenEmpty: false }),
            ],
          },
          {
            heading: "Deliver To",
            align: "left",
            fields: [
              field("Client Name:", "{{deliverTo.organisation}}", {
                hideWhenEmpty: false,
              }),
              field("Address:", "{{deliverTo.address}}", {
                hideWhenEmpty: false,
              }),
              field("Contact Person:", "{{deliverTo.contactPerson}}"),
              field("Phone:", "{{deliverTo.phone}}"),
              field("Email:", "{{deliverTo.email}}"),
            ],
          },
        ],
      },
    },
    detailsHeading("details", { marginTop: 14, marginBottom: 6 }),
    {
      id: "table",
      type: "lineTable",
      props: {
        columns: [
          column("sn", "S/N", 0.4),
          column("description", "Product", 2.5),
          column("brandOrigin", "Brand", 1.0),
          column("specification", "Specification", 2.2),
          column("qty", "Qty", 1.1, { align: "right" }),
          column("unit", "Unit", 1.1, { emptyText: "PCS" }),
          column("unitPrice", "Unit Price\n(BDT)", 1.05, {
            align: "right",
            visible: false,
          }),
          column("vat", "VAT\n(%/BDT)", 1.35, {
            align: "right",
            visible: false,
          }),
          column("lineTotal", "Total Amount\n(BDT)", 1.15, {
            align: "right",
            visible: false,
          }),
        ],
        vatColumn: "never",
        // The invoice's totals stack, reduced to the only figure a challan
        // has: how many items left the building.
        totals: {
          labelColumns: ["specification"],
          valueColumns: ["qty", "unit"],
          rows: [
            totalsRow("qty", "Total Qty", "totals.totalQty", {
              emphasis: true,
              valueAlign: "center",
            }),
          ],
        },
      },
    },
    {
      id: "dispatch",
      type: "labelledText",
      showIf: "dispatchNote",
      style: { marginTop: 8 },
      props: {
        label: "Dispatch:",
        labelStyle: "bold",
        text: "{{dispatchNote}}",
      },
    },
    {
      id: "terms",
      type: "bullets",
      style: { marginTop: 9 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Terms & Condition:",
        headingGap: 5,
        items: [
          "Please check the goods against this challan before signing.",
          returnsTerm,
          "This challan is not a bill. It carries no prices, and no payment is due against it.",
        ],
      },
    },
    {
      id: "signoff",
      type: "signOff",
      props: {
        left: "Delivered By",
        right: "Received By",
        includeSignatory: false,
        labelAlign: "center",
      },
    },
  ],
};

/* ─────────────────────── equipment proposal ─────────────────────── */

/**
 * The quotation for a high-value machine: a letter, not a table.
 *
 * Wording is the company's own equipment letter, tidied: the equipment is
 * named in the opening paragraph, the price is one figure spelled out in
 * words, and the manufacturer closes the numbered terms. Each term is a
 * placeholder because each is negotiated per deal — the dialog that
 * generates the proposal opens with the standard wording and lets it be
 * changed. The opening paragraph has an override the same way: when
 * `intro` is given it prints instead of the standard one.
 */
const equipmentProposal: TemplateDoc = {
  documentTitle: "Quotation {{proposalNo}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    {
      id: "header",
      type: "metaColumns",
      style: { marginTop: 0 },
      props: {
        gap: 24,
        lineGap: 1,
        columns: [
          {
            align: "left",
            fields: [
              field("Ref:", "{{proposalNo}}", { hideWhenEmpty: false }),
              field("Date:", "{{date}}", { hideWhenEmpty: false }),
              field(
                "Validity:",
                "{{terms.validityDays}} days from the date above",
                {
                  hideWhenEmpty: false,
                },
              ),
            ],
          },
          {
            heading: "To",
            align: "left",
            fields: [
              field(undefined, "{{to.attention}}"),
              field(undefined, "{{to.department}}"),
              field(undefined, "{{to.organisation}}", {
                hideWhenEmpty: false,
                bold: true,
              }),
              field(undefined, "{{to.address}}", { hideWhenEmpty: false }),
              field("Phone:", "{{to.phone}}"),
              field("E-mail:", "{{to.email}}"),
            ],
          },
        ],
      },
    },
    {
      id: "subject",
      type: "heading",
      props: { text: "Subject: {{subject}}", underline: true },
      style: { marginTop: 10 },
    },
    {
      id: "greeting",
      type: "paragraph",
      props: { text: "Dear Sir/Madam," },
      style: { marginTop: 8 },
    },
    {
      // The standard opening, naming the machines from the order's lines.
      id: "intro",
      type: "paragraph",
      showIf: "!intro",
      props: {
        text: "Thank you for choosing {{company.name}} to help streamline your healthcare operations. We are pleased to quote our best price for the {{equipment.summary}}.",
      },
      style: { marginTop: 6, align: "justify" },
    },
    {
      // What was typed in the dialog, when anything was.
      id: "introCustom",
      type: "paragraph",
      showIf: "intro",
      props: { text: "{{intro}}" },
      style: { marginTop: 6, align: "justify" },
    },
    {
      id: "spec",
      type: "labelledText",
      showIf: "equipment.specification",
      style: { marginTop: 6, align: "justify" },
      props: {
        label: "Specification:",
        labelStyle: "bold",
        text: "{{equipment.specification}}",
      },
    },
    {
      // A negotiated discount is shown as the list price less the discount,
      // so the offered price below reads as a concession and not a mystery.
      id: "listPrice",
      type: "labelledText",
      showIf: "price.discountMinor",
      style: { marginTop: 8 },
      props: {
        label: "List price:",
        labelStyle: "bold",
        text: "BDT {{price.subtotalMinor}}",
      },
    },
    {
      id: "discount",
      type: "labelledText",
      showIf: "price.discountMinor",
      style: { marginTop: 3 },
      props: {
        label: "Less discount:",
        labelStyle: "bold",
        text: "BDT {{price.discountMinor}}",
      },
    },
    {
      // The figure the letter exists for: in numbers, then in words.
      id: "price",
      type: "labelledText",
      style: { marginTop: 8, fontSize: 11.5 },
      props: {
        label: "Offered price:",
        labelStyle: "bold",
        text: "BDT {{price.goodsMinor}} ({{price.goodsInWords}})",
      },
    },
    {
      id: "vat",
      type: "labelledText",
      showIf: "price.vatMinor",
      style: { marginTop: 3 },
      props: {
        label: "VAT{{price.vatSuffix}}:",
        labelStyle: "bold",
        text: "BDT {{price.vatMinor}}, payable in addition to the price above.",
      },
    },
    {
      id: "transport",
      type: "labelledText",
      showIf: "price.deliveryMinor",
      style: { marginTop: 3 },
      props: {
        label: "Transport and delivery:",
        labelStyle: "bold",
        text: "BDT {{price.deliveryMinor}}",
      },
    },
    {
      id: "total",
      type: "labelledText",
      showIf: "price.hasExtras",
      style: { marginTop: 3 },
      props: {
        label: "Total:",
        labelStyle: "bold",
        text: "BDT {{price.totalMinor}} ({{price.totalInWords}})",
      },
    },
    {
      // Stated so the client's accounts department knows what to expect;
      // never added, because it is their deduction, not our charge.
      id: "ait",
      type: "labelledText",
      showIf: "price.aitMinor",
      style: { marginTop: 3, fontSize: 10 },
      props: {
        label: "AIT ({{price.aitPercent}}%):",
        labelStyle: "bold",
        text: "BDT {{price.aitMinor}} may be deducted at source under the Income Tax Act. It is not included in the price above.",
      },
    },
    {
      id: "terms",
      type: "bullets",
      style: { marginTop: 10 },
      keepTogether: true,
      minPresenceAhead: 120,
      props: {
        heading: "Terms and conditions:",
        headingGap: 6,
        numbered: true,
        hideEmptyItems: true,
        items: [
          "Payment: {{terms.payment}}",
          "Installation and commissioning: {{terms.installation}}",
          "Warranty: {{terms.warranty}}",
          "After the warranty period: {{terms.afterWarranty}}",
          "Delivery: {{terms.delivery}}",
          "Training: {{terms.training}}",
          "Manufacturer: {{equipment.manufacturers}}",
        ],
      },
    },
    {
      id: "closing",
      type: "paragraph",
      style: { marginTop: 10, align: "justify" },
      props: {
        text: "We trust that this price is our most competitive and will be acceptable to you, and we look forward to receiving your valued work order at your earliest convenience.",
      },
    },
    {
      id: "thanks",
      type: "paragraph",
      style: { marginTop: 5 },
      props: { text: "Thank you for your continued cooperation." },
    },
    {
      id: "regards",
      type: "paragraph",
      style: { marginTop: 5 },
      props: { text: "With best regards," },
    },
    {
      // The Managing Director signs the letter: name, title, company, phone
      // and e-mail under the line, as the company's own template asks.
      id: "signoff",
      type: "signOff",
      props: {
        left: "Authorised Signatory",
        includeSignatory: true,
        labelAlign: "left",
      },
    },
  ],
};

/* ─────────────────────── equipment invoice ─────────────────────── */

/**
 * The invoice for a machine: the sales invoice's header and foot around one
 * price — in numbers, then in words — with VAT, transport and the AIT note
 * beneath it. No ruled table, because there is nothing to tabulate: what
 * was supplied is said in a sentence.
 */
const equipmentInvoice: TemplateDoc = {
  documentTitle: "Sales Invoice {{invoiceNumber}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    { id: "title", type: "title", props: { text: "Sales Invoice" } },
    {
      id: "header",
      type: "metaColumns",
      style: { marginTop: 8 },
      props: {
        gap: 24,
        lineGap: 1,
        columns: [
          {
            align: "left",
            fields: [
              field("Invoice No:", "{{invoiceNumber}}", {
                hideWhenEmpty: false,
              }),
              field("Date:", "{{invoiceDate}}", { hideWhenEmpty: false }),
              field("Payment Due:", "{{paymentDue}}", { hideWhenEmpty: false }),
              field("Customer ID:", "{{customerId}}"),
              field("Reference/PO No:", "{{referenceNo}}"),
              field("Date of Delivery:", "{{deliveryDate}}"),
              field("BIN:", "{{company.bin}}", { hideWhenEmpty: false }),
            ],
          },
          {
            heading: "Bill To",
            align: "left",
            fields: [
              field("Client Name:", "{{billTo.organisation}}", {
                hideWhenEmpty: false,
              }),
              field("Address:", "{{billTo.address}}", { hideWhenEmpty: false }),
              field("Contact Person:", "{{billTo.contactPerson}}"),
              field("Phone:", "{{billTo.phone}}"),
              field("Email:", "{{billTo.email}}"),
            ],
          },
        ],
      },
    },
    {
      id: "details",
      type: "heading",
      props: { text: "Particulars", underline: true },
      style: { marginTop: 14, marginBottom: 6 },
    },
    {
      id: "description",
      type: "paragraph",
      style: { align: "justify" },
      props: {
        text: "Supply of the {{equipment.summary}}. Manufacturer: {{equipment.manufacturers}}.",
      },
    },
    {
      id: "spec",
      type: "labelledText",
      showIf: "equipment.specification",
      style: { marginTop: 4, align: "justify" },
      props: {
        label: "Specification:",
        labelStyle: "bold",
        text: "{{equipment.specification}}",
      },
    },
    {
      id: "listPrice",
      type: "labelledText",
      showIf: "totals.discountMinor",
      style: { marginTop: 10 },
      props: {
        label: "List price:",
        labelStyle: "bold",
        text: "BDT {{totals.subtotalMinor}}",
      },
    },
    {
      id: "discount",
      type: "labelledText",
      showIf: "totals.discountMinor",
      style: { marginTop: 3 },
      props: {
        label: "Less discount:",
        labelStyle: "bold",
        text: "BDT {{totals.discountMinor}}",
      },
    },
    {
      id: "price",
      type: "labelledText",
      style: { marginTop: 10, fontSize: 11.5 },
      props: {
        label: "Price:",
        labelStyle: "bold",
        text: "BDT {{totals.goodsMinor}} ({{totals.goodsInWords}})",
      },
    },
    {
      id: "vat",
      type: "labelledText",
      showIf: "totals.vatMinor",
      style: { marginTop: 3 },
      props: {
        label: "VAT{{vat.rateSuffix}}:",
        labelStyle: "bold",
        text: "BDT {{totals.vatMinor}}",
      },
    },
    {
      id: "transport",
      type: "labelledText",
      showIf: "totals.deliveryMinor",
      style: { marginTop: 3 },
      props: {
        label: "Transport/ Delivery:",
        labelStyle: "bold",
        text: "BDT {{totals.deliveryMinor}}",
      },
    },
    {
      // Only when something sits on top of the price; otherwise the price
      // line IS the total and repeating it in words would say nothing new.
      id: "total",
      type: "labelledText",
      showIf: "totals.hasExtras",
      style: { marginTop: 3, fontSize: 11.5 },
      props: {
        label: "Grand Total:",
        labelStyle: "bold",
        text: "BDT {{totals.grandTotalMinor}} ({{totals.amountInWords}})",
      },
    },
    {
      id: "paid",
      type: "labelledText",
      showIf: "totals.paidMinor",
      style: { marginTop: 3 },
      props: {
        label: "Paid:",
        labelStyle: "bold",
        text: "BDT {{totals.paidMinor}}",
      },
    },
    {
      id: "balance",
      type: "labelledText",
      showIf: "totals.paidMinor",
      style: { marginTop: 3 },
      props: {
        label: "Balance Due/ Outstanding:",
        labelStyle: "bold",
        text: "BDT {{totals.balanceMinor}}",
      },
    },
    {
      id: "ait",
      type: "labelledText",
      showIf: "ait.amountMinor",
      style: { marginTop: 5, fontSize: 10 },
      props: {
        label: "AIT ({{ait.ratePercent}}%):",
        labelStyle: "bold",
        text: "BDT {{ait.amountMinor}} — deductible at source and NOT included in the total above.",
      },
    },
    {
      id: "bank",
      type: "keyValueList",
      style: { marginTop: 12 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Payment Information:",
        headingGap: 5,
        items: [
          {
            label: "Bank Name:",
            value: "{{bank.bankName}}",
            hideWhenEmpty: false,
          },
          {
            label: "Account Name:",
            value: "{{bank.accountName}}",
            hideWhenEmpty: false,
          },
          {
            label: "Account No:",
            value: "{{bank.accountNo}}",
            hideWhenEmpty: false,
          },
          { label: "Branch:", value: "{{bank.branch}}", hideWhenEmpty: false },
          {
            label: "Routing No:",
            value: "{{bank.routingNo}}",
            hideWhenEmpty: false,
          },
          {
            label: "Mobile Finance Service:",
            value: "{{bank.mobileFinance}}",
            hideWhenEmpty: false,
          },
        ],
      },
    },
    {
      id: "terms",
      type: "bullets",
      style: { marginTop: 9 },
      keepTogether: true,
      minPresenceAhead: 96,
      props: {
        heading: "Terms & Condition:",
        headingGap: 5,
        items: [
          "Payment Terms: Payment due within {{terms.paymentDays}} days of this invoice.",
          "If Advance Income Tax (AIT)/Tax Deducted at Source (TDS) is deducted under the applicable Income Tax laws, kindly provide the prescribed withholding tax certificate to {{company.name}}.",
          "Installation, commissioning, training and warranty are as agreed in our quotation.",
        ],
      },
    },
    {
      id: "signoff",
      type: "signOff",
      props: {
        left: "Approved By",
        right: "Received By",
        includeSignatory: false,
        labelAlign: "center",
      },
    },
  ],
};

/* ─────────────────────────────── payslip ─────────────────────────────── */

/**
 * States the basis openly — the month's revenue and the agreed percentage —
 * because that is the whole calculation, and a payslip that only showed the
 * final figure would be impossible to check.
 */
const payslip: TemplateDoc = {
  documentTitle: "Payslip {{employee.name}} {{month}}",
  theme: DEFAULT_THEME,
  blocks: [
    ...stationery(),
    { id: "title", type: "title", props: { text: "Payslip — {{monthLabel}}" } },
    {
      id: "header",
      type: "metaColumns",
      style: { marginBottom: 10 },
      props: {
        gap: 0,
        lineGap: 0,
        columns: [
          {
            align: "left",
            fields: [
              field(undefined, "{{employee.name}}", {
                bold: true,
                hideWhenEmpty: false,
              }),
              field(undefined, "{{employee.designation}}", {
                hideWhenEmpty: false,
              }),
              field(undefined, "Employee code: {{employee.code}}", {
                small: true,
                hideWhenEmpty: false,
              }),
            ],
          },
          {
            align: "right",
            fields: [
              field(undefined, "Period: {{monthLabel}}", {
                hideWhenEmpty: false,
              }),
              field(undefined, "Approved: {{approvedAt}}"),
              field(undefined, "Paid: {{paidAt}}"),
              field(undefined, "Reference: {{reference}}"),
            ],
          },
        ],
      },
    },
    {
      id: "basis",
      type: "keyValueTable",
      props: {
        header: { label: "Basis", value: "Amount (BDT)" },
        headerRule: "hairline",
        // Three ways a line can have been computed, each showing its own
        // working: a shareholding (the live scheme), a fixed salary, and the
        // percentage of revenue the first version of payroll used.
        rows: [
          {
            label: "Gross profit for the month",
            value: "{{pool.grossProfitMinor}}",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Less order costs",
            value: "{{pool.orderCostsMinor}}",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Less client visits",
            value: "{{pool.expensesMinor}}",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Less AIT withheld by clients",
            value: "{{pool.aitMinor}}",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Less fixed salaries",
            value: "{{pool.salariesMinor}}",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Split between the directors",
            value: "{{pool.distributableMinor}}",
            strong: true,
            showIf: "hasShares",
          },
          {
            label: "Shares held",
            value: "{{shares}} of {{poolShares}} ({{holdingPercent}}%)",
            strong: false,
            showIf: "hasShares",
          },
          {
            label: "Revenue from the website",
            value: "{{onlineMinor}}",
            strong: false,
            showIf: "hasRate",
          },
          {
            label: "Revenue from sales orders",
            value: "{{manualMinor}}",
            strong: false,
            showIf: "hasRate",
          },
          {
            label: "Total revenue for the month",
            value: "{{revenueMinor}}",
            strong: true,
            showIf: "hasRate",
          },
          {
            label: "Agreed share",
            value: "{{ratePercent}}%",
            strong: false,
            showIf: "hasRate",
          },
          {
            label: "Basis",
            value: "Fixed monthly",
            strong: false,
            showIf: "isFixed",
          },
          {
            label: "Payable this month",
            value: "{{amountMinor}}",
            strong: true,
          },
        ],
      },
    },
    {
      id: "words",
      type: "labelledText",
      style: { marginTop: 12 },
      props: {
        label: "Amount in Words:",
        labelStyle: "bold",
        text: "{{amountInWords}}",
      },
    },
    {
      id: "note",
      type: "paragraph",
      style: { marginTop: 14, fontSize: 10, muted: true },
      props: {
        text: "Issued by {{company.name}}. Revenue is counted when payment was received, and excludes cancelled and refunded orders.",
      },
    },
    {
      id: "signoff",
      type: "signOff",
      props: {
        left: "Approved By",
        right: "Received By",
        includeSignatory: false,
        labelAlign: "center",
      },
    },
  ],
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, TemplateDoc> = {
  proposal,
  invoice,
  challan,
  payslip,
  equipmentProposal,
  equipmentInvoice,
};

/** A deep copy, so an editor can mutate its working document freely. */
export function defaultTemplate(kind: TemplateKind): TemplateDoc {
  return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES[kind])) as TemplateDoc;
}
