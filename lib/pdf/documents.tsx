import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { LEGAL, BANK } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import {
  styles,
  Letterhead,
  FooterBand,
  Watermark,
  SignOffRow,
} from "./letterhead";
import { formatTaka, fmtDate, fmtLongDate } from "./format";

/**
 * The two documents the sales flow produces.
 *
 * Structure, field set and wording come from the company's own Word templates
 * (`.docs/samples/*.docx`); the visual styling — letterhead, teal rules, ruled
 * table, watermark, footer band — comes from the scanned PDFs of documents they
 * actually sent. That split is deliberate and was the client's instruction.
 *
 * Both carry the same eight-column table, so a proposal and the invoice that
 * follows it read as the same document to whoever receives them.
 */

export type DocumentLine = {
  /** "Product" on the printed table. */
  description: string;
  /** "Brand". */
  brandOrigin?: string | null;
  specification?: string | null;
  unit?: string | null;
  unitPriceMinor: number;
  qty: number;
  lineTotalMinor: number;
  /** VAT this line carries, when the order sets VAT line by line. */
  vatMinor?: number | null;
  /** What that works out at as a rate; decides whether a column is needed. */
  vatRateBp?: number | null;
};

/**
 * Does this table need a VAT column?
 *
 * Only when the lines disagree. One rate across the whole document is said
 * once in the totals block, and a column repeating it on every row is noise;
 * the moment two lines are taxed differently, a reader cannot reconcile the
 * total without seeing which line is which.
 */
/**
 * A line's VAT as it prints: the rate AND what it comes to.
 *
 * Both, because the column exists precisely when the rates differ — an amount
 * on its own leaves the reader working backwards to find out why one line was
 * taxed more than the one above it.
 */
export function vatCell(line: DocumentLine): string {
  const rate = (line.vatRateBp ?? 0) / 100;
  // No trailing zeros: 5, 7.5, 15 — not 5.00.
  const shown = Number.isInteger(rate)
    ? String(rate)
    : String(Number(rate.toFixed(2)));
  return `${shown}%/${formatTaka(line.vatMinor ?? 0)}`;
}

export function needsVatColumn(lines: DocumentLine[]): boolean {
  const rates = lines.map((l) => l.vatRateBp ?? 0);
  return rates.length > 1 && rates.some((r) => r !== rates[0]);
}

export type Signatory = {
  name: string;
  title: string;
  phone?: string;
  email?: string;
};

/** The other side of the document: who it is addressed to. */
export type Party = {
  organisation: string;
  address: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Proposals only. */
  department?: string | null;
  attention?: string | null;
};

export type ProposalData = {
  proposalNo: string;
  date: Date;
  to: Party;
  subject: string;
  intro: string;
  lines: DocumentLine[];
  terms: {
    deliveryDays: number;
    validityDays: number;
    paymentDays: number;
    returnPolicy?: string | null;
  };
  signatory: Signatory;
};

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: Date;
  paymentDue: Date;
  customerId?: string | null;
  referenceNo?: string | null;
  deliveryDate?: Date | null;
  billTo: Party;
  lines: DocumentLine[];
  subtotalMinor: number;
  discountMinor: number;
  vatRateBp: number;
  vatMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  /** What has been received so far; the balance is derived from it. */
  paidMinor: number;
  /**
   * The rate the client is expected to withhold at source.
   *
   * Printed as a note and never added to the total: AIT is the buyer's
   * deduction from what they pay us, so charging it here would bill them for
   * money they are keeping.
   */
  aitRateBp?: number;
  paymentDays: number;
  signatory: Signatory;
};

const col = (flex: number, last = false) => ({
  flex,
  ...(last ? { borderRightWidth: 0 } : {}),
});

/** The columns both documents share. The proposal drops the last one: it
    quotes a price per piece, so a "total" beside a quantity of one would only
    repeat the figure to its left. The invoice, which is what actually gets
    added up, keeps it. */
const COLS = {
  sn: 0.4,
  product: 2.5,
  brand: 1.0,
  spec: 2.2,
  qty: 0.55,
  unit: 0.55,
  price: 1.05,
  // Wider than the money columns: it carries a rate and an amount together.
  vat: 1.35,
  total: 1.15,
};

/** The empty run at the left of every totals row, as one cell. */
const TOTALS_SPAN = COLS.sn + COLS.product + COLS.brand + COLS.spec;

function TableHead({
  showTotal = true,
  showVat = false,
}: {
  showTotal?: boolean;
  showVat?: boolean;
}) {
  return (
    <View style={styles.trHead}>
      <Text style={[styles.th, col(COLS.sn)]}>S/N</Text>
      <Text style={[styles.th, col(COLS.product)]}>Product</Text>
      <Text style={[styles.th, col(COLS.brand)]}>Brand</Text>
      <Text style={[styles.th, col(COLS.spec)]}>Specification</Text>
      <Text style={[styles.th, col(COLS.qty)]}>Qty</Text>
      <Text style={[styles.th, col(COLS.unit)]}>Unit</Text>
      <Text style={[styles.th, col(COLS.price, !showTotal && !showVat)]}>
        Unit Price{"\n"}(BDT)
      </Text>
      {showVat && (
        <Text style={[styles.th, col(COLS.vat, !showTotal)]}>
          VAT{"\n"}(%/BDT)
        </Text>
      )}
      {showTotal && (
        <Text style={[styles.th, col(COLS.total, true)]}>
          Total Amount{"\n"}(BDT)
        </Text>
      )}
    </View>
  );
}

function LineRow({
  line,
  n,
  showTotal = true,
  showVat = false,
}: {
  line: DocumentLine;
  n: number;
  showTotal?: boolean;
  showVat?: boolean;
}) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, col(COLS.sn)]}>{n}</Text>
      {/* Product, Brand and Specification are centred: the client marked all
          three on the sample. `td` already centres, so these carry no
          alignment of their own. */}
      <Text style={[styles.td, col(COLS.product)]}>{line.description}</Text>
      <Text style={[styles.td, col(COLS.brand)]}>{line.brandOrigin ?? ""}</Text>
      <Text style={[styles.td, col(COLS.spec)]}>
        {line.specification ?? ""}
      </Text>
      <Text style={[styles.td, col(COLS.qty)]}>{line.qty}</Text>
      <Text style={[styles.td, col(COLS.unit)]}>{line.unit || "PCS"}</Text>
      <Text
        style={[
          styles.td,
          styles.tdNum,
          col(COLS.price, !showTotal && !showVat),
        ]}
      >
        {formatTaka(line.unitPriceMinor)}
      </Text>
      {showVat && (
        <Text style={[styles.td, styles.tdNum, col(COLS.vat, !showTotal)]}>
          {vatCell(line)}
        </Text>
      )}
      {showTotal && (
        <Text style={[styles.td, styles.tdNum, col(COLS.total, true)]}>
          {formatTaka(line.lineTotalMinor)}
        </Text>
      )}
    </View>
  );
}

/** "Label: value" as the templates set their header blocks. */
function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Text style={styles.metaLine}>
      <Text style={styles.label}>{label} </Text>
      {value ?? ""}
    </Text>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

// ───────────────────────────── proposal ─────────────────────────────

export function ProposalDocument({ data }: { data: ProposalData }) {
  const vatColumn = needsVatColumn(data.lines);
  return (
    <Document title={`Commercial Proposal ${data.proposalNo}`}>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <Letterhead />

        <Text style={styles.title}>Commercial Proposal</Text>

        {/* Our reference on the left, theirs on the right. */}
        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Field label="Proposal No:" value={data.proposalNo} />
            <Field label="Date:" value={fmtLongDate(data.date)} />
            <Field
              label="Validity:"
              value={`${data.terms.validityDays} days from submission`}
            />
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyHeading}>Proposal To</Text>
            <Field label="Client:" value={data.to.organisation} />
            {data.to.department ? (
              <Field label="Department:" value={data.to.department} />
            ) : null}
            <Field label="Address:" value={data.to.address} />
            {data.to.attention ? (
              <Field label="Contact Person:" value={data.to.attention} />
            ) : null}
            {data.to.phone ? (
              <Field label="Contact:" value={data.to.phone} />
            ) : null}
            {data.to.email ? (
              <Field label="E-mail:" value={data.to.email} />
            ) : null}
          </View>
        </View>

        <Text style={[styles.underlineLabel, { marginTop: 14 }]}>
          Subject: {data.subject}
        </Text>

        <View style={[styles.section, { marginTop: 12 }]}>
          <Text>Dear Sir/Madam,</Text>
          <Text style={{ marginTop: 8, textAlign: "justify" }}>
            {data.intro}
          </Text>
        </View>

        <Text style={[styles.underlineLabel, { marginBottom: 6 }]}>
          Product/ Service Details
        </Text>
        <View style={styles.table}>
          <TableHead showTotal={false} showVat={vatColumn} />
          {data.lines.map((l, i) => (
            <LineRow
              key={i}
              line={l}
              n={i + 1}
              showTotal={false}
              showVat={vatColumn}
            />
          ))}
        </View>

        <View style={{ marginTop: 16 }} wrap={false} minPresenceAhead={96}>
          <Text style={styles.underlineLabel}>Terms &amp; Conditions:</Text>
          <View style={{ marginTop: 6 }}>
            <Bullet>
              Price Offer Validity: {data.terms.validityDays} Days after
              submission of the proposal
            </Bullet>
            <Bullet>
              Delivery: Within {data.terms.deliveryDays} working days after
              getting the work order at the clients premises
            </Bullet>
            <Bullet>Competitive Institutional Pricing</Bullet>
            <Bullet>After Sales Service (If Applicable)</Bullet>
            <Bullet>Dedicated Corporate/Institutional Support</Bullet>
          </View>
        </View>

        <SignOffRow left="Approved By" signatory={data.signatory} />
        <FooterBand />
      </Page>
    </Document>
  );
}

// ───────────────────────────── invoice ─────────────────────────────

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const balanceMinor = Math.max(0, data.totalMinor - data.paidMinor);
  const totalQty = data.lines.reduce((n, l) => n + l.qty, 0);
  const vatColumn = needsVatColumn(data.lines);
  // Same base as the storefront invoice uses: the goods after any discount,
  // before VAT. Display only — see the note further down the page.
  const aitMinor = data.aitRateBp
    ? Math.round(
        ((data.subtotalMinor - data.discountMinor) * data.aitRateBp) / 10000,
      )
    : 0;

  return (
    <Document title={`Sales Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <Letterhead />

        <Text style={styles.title}>Sales Invoice</Text>

        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Field label="Invoice No:" value={data.invoiceNumber} />
            <Field label="Date:" value={fmtDate(data.invoiceDate)} />
            <Field label="Payment Due:" value={fmtDate(data.paymentDue)} />
            {data.customerId ? (
              <Field label="Customer ID:" value={data.customerId} />
            ) : null}
            {data.referenceNo ? (
              <Field label="Reference/PO No:" value={data.referenceNo} />
            ) : null}
            {data.deliveryDate ? (
              <Field
                label="Date of Delivery:"
                value={fmtDate(data.deliveryDate)}
              />
            ) : null}
            <Field label="BIN:" value={LEGAL.bin || "—"} />
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyHeading}>Bill To</Text>
            <Field label="Client Name:" value={data.billTo.organisation} />
            <Field label="Address:" value={data.billTo.address} />
            {data.billTo.contactPerson ? (
              <Field
                label="Contact Person:"
                value={data.billTo.contactPerson}
              />
            ) : null}
            {data.billTo.phone ? (
              <Field label="Phone:" value={data.billTo.phone} />
            ) : null}
            {data.billTo.email ? (
              <Field label="Email:" value={data.billTo.email} />
            ) : null}
          </View>
        </View>

        <Text
          style={[styles.underlineLabel, { marginTop: 14, marginBottom: 6 }]}
        >
          Product/ Service Details
        </Text>

        <View style={styles.table}>
          <TableHead showVat={vatColumn} />
          {data.lines.map((l, i) => (
            <LineRow key={i} line={l} n={i + 1} showVat={vatColumn} />
          ))}

          {/* The template's totals stack. Discount, VAT and Transport appear
              only when actually charged, so a plain invoice reads exactly like
              the scanned one. */}
          <TotalRow
            label="Total Qty"
            value={String(totalQty)}
            unitsOnly
            first
            showVat={vatColumn}
          />
          <TotalRow
            label="Subtotal"
            value={formatTaka(data.subtotalMinor)}
            showVat={vatColumn}
          />
          {data.discountMinor > 0 && (
            <TotalRow
              label="Discount"
              value={`−${formatTaka(data.discountMinor)}`}
              showVat={vatColumn}
            />
          )}
          {data.vatMinor > 0 && (
            <TotalRow
              /* With a VAT column the rate differs line by line, so naming one
                 rate here would contradict the table above it. */
              label={vatColumn ? "VAT" : `VAT (${data.vatRateBp / 100}%)`}
              value={formatTaka(data.vatMinor)}
              showVat={vatColumn}
            />
          )}
          {data.deliveryMinor > 0 && (
            <TotalRow
              label="Transport/ Delivery"
              value={formatTaka(data.deliveryMinor)}
              showVat={vatColumn}
            />
          )}
          <TotalRow
            label="Grand Total"
            value={formatTaka(data.totalMinor)}
            emphasis
            showVat={vatColumn}
          />
          {data.paidMinor > 0 && (
            <TotalRow
              label="Paid"
              value={formatTaka(data.paidMinor)}
              showVat={vatColumn}
            />
          )}
          <TotalRow
            label="Balance Due/ Outstanding"
            value={formatTaka(balanceMinor)}
            emphasis
            last
            showVat={vatColumn}
          />
        </View>

        <Text style={{ marginTop: 8 }}>
          <Text style={styles.underlineLabel}>Amount in Words:</Text>{" "}
          {amountInWords(data.totalMinor)}
        </Text>

        {/* Stated, never charged. The client deducts this from the payment and
            pays it to the NBR on our behalf, so it is not part of the total —
            saying so on the invoice is what stops it being paid twice. */}
        {aitMinor > 0 && (
          <Text style={[styles.small, { marginTop: 5 }]}>
            <Text style={styles.label}>
              AIT ({(data.aitRateBp ?? 0) / 100}%):
            </Text>{" "}
            {formatTaka(aitMinor)} — deductible at source and NOT included in
            the total above.
          </Text>
        )}

        <View style={{ marginTop: 9 }} wrap={false} minPresenceAhead={96}>
          <Text style={styles.underlineLabel}>Payment Information:</Text>
          <View style={{ marginTop: 5 }}>
            <Field label="Bank Name:" value={BANK.bankName} />
            <Field label="Account Name:" value={BANK.accountName} />
            <Field label="Account No:" value={BANK.accountNo} />
            <Field label="Branch:" value={BANK.branch} />
            <Field label="Routing No:" value={BANK.routingNo} />
            <Field label="Mobile Finance Service:" value={BANK.mobileFinance} />
          </View>
        </View>

        <View style={{ marginTop: 9 }} wrap={false} minPresenceAhead={96}>
          <Text style={styles.underlineLabel}>Terms &amp; Condition:</Text>
          <View style={{ marginTop: 5 }}>
            <Bullet>
              Payment Terms: Payment due within {data.paymentDays} days of this
              invoice.
            </Bullet>
            <Bullet>
              If Advance Income Tax (AIT)/Tax Deducted at Source (TDS) is
              deducted under the applicable Income Tax laws, kindly provide the
              prescribed withholding tax certificate to {LEGAL.name}.
            </Bullet>
            <Bullet>
              Any malfunctioning and mismatched products those need to be
              returned, you should contact us within 3 days after the delivery
              of the products.
            </Bullet>
          </View>
        </View>

        <SignOffRow left="Approved By" right="Received By" />
        <FooterBand />
      </Page>
    </Document>
  );
}

/**
 * A totals row.
 *
 * The columns to the left of the label are ONE empty cell rather than four
 * ruled ones: a stack of empty boxes running down the page was the thing that
 * made this table read as a grid. `first` puts a full rule above, closing the
 * items off from the sums; `emphasis` tints the figure the reader came for.
 */
function TotalRow({
  label,
  value,
  first = false,
  last = false,
  unitsOnly = false,
  emphasis = false,
  showVat = false,
}: {
  label: string;
  value: string;
  first?: boolean;
  last?: boolean;
  unitsOnly?: boolean;
  emphasis?: boolean;
  /** The table carries a VAT column, so the label runs one cell wider. */
  showVat?: boolean;
}) {
  const row = first ? styles.trTotalsStart : last ? styles.trLast : styles.tr;
  return (
    <View style={row}>
      <View style={[styles.tdSpan, col(TOTALS_SPAN)]} />
      <Text
        style={[
          styles.td,
          styles.tdNum,
          col(COLS.qty + COLS.unit + COLS.price + (showVat ? COLS.vat : 0)),
          styles.label,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.td,
          unitsOnly ? {} : styles.tdNum,
          col(COLS.total, true),
          styles.label,
          emphasis ? styles.tdStrong : {},
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ───────────────────────────── delivery challan ─────────────────────────────

export type ChallanData = {
  challanNumber: string;
  date: Date;
  /** The invoice these goods are being delivered against. */
  invoiceNumber?: string | null;
  /** The client's own purchase-order reference, where they gave one. */
  referenceNo?: string | null;
  deliverTo: Party;
  lines: DocumentLine[];
  /** Vehicle, driver, courier — whatever was written on the day. */
  dispatchNote?: string | null;
};

/**
 * The note that travels with the goods.
 *
 * Laid out as the sales invoice is — same letterhead, same two-column header,
 * same ruled table, same sign-off — with every trace of money taken out: no
 * unit price, no VAT, no totals, no bank details, no amount in words. The two
 * documents are meant to read as a pair, because they describe one delivery
 * to one client, and the client asked for exactly that.
 *
 * What is left is the only thing a challan is for: what went out, how much of
 * it, and a line for whoever took it in to sign. The price is between their
 * accounts department and the invoice.
 */
export function ChallanDocument({ data }: { data: ChallanData }) {
  const totalQty = data.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <Document title={`Delivery Challan ${data.challanNumber}`}>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <Letterhead />

        <Text style={styles.title}>Delivery Challan</Text>

        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Field label="Challan No:" value={data.challanNumber} />
            <Field label="Date:" value={fmtDate(data.date)} />
            {data.invoiceNumber ? (
              <Field label="Against Invoice:" value={data.invoiceNumber} />
            ) : null}
            {data.referenceNo ? (
              <Field label="Reference/PO No:" value={data.referenceNo} />
            ) : null}
            <Field label="BIN:" value={LEGAL.bin || "—"} />
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyHeading}>Deliver To</Text>
            <Field label="Client Name:" value={data.deliverTo.organisation} />
            <Field label="Address:" value={data.deliverTo.address} />
            {data.deliverTo.contactPerson ? (
              <Field
                label="Contact Person:"
                value={data.deliverTo.contactPerson}
              />
            ) : null}
            {data.deliverTo.phone ? (
              <Field label="Phone:" value={data.deliverTo.phone} />
            ) : null}
            {data.deliverTo.email ? (
              <Field label="Email:" value={data.deliverTo.email} />
            ) : null}
          </View>
        </View>

        <Text
          style={[styles.underlineLabel, { marginTop: 14, marginBottom: 6 }]}
        >
          Product/ Service Details
        </Text>

        <View style={styles.table}>
          <ChallanHead />
          {data.lines.map((l, i) => (
            <ChallanRow key={i} line={l} n={i + 1} />
          ))}

          {/* The invoice's totals stack, reduced to the only figure a challan
              has: how many items left the building. */}
          <View style={styles.trTotalsStart}>
            <View
              style={[styles.tdSpan, col(COLS.sn + COLS.product + COLS.brand)]}
            />
            <Text
              style={[styles.td, styles.tdNum, col(COLS.spec), styles.label]}
            >
              Total Qty
            </Text>
            <Text
              style={[
                styles.td,
                col(CHALLAN_QTY + CHALLAN_UNIT, true),
                styles.label,
                styles.tdStrong,
              ]}
            >
              {totalQty}
            </Text>
          </View>
        </View>

        {data.dispatchNote ? (
          <Text style={{ marginTop: 8 }}>
            <Text style={styles.label}>Dispatch:</Text> {data.dispatchNote}
          </Text>
        ) : null}

        <View style={{ marginTop: 9 }} wrap={false} minPresenceAhead={96}>
          <Text style={styles.underlineLabel}>Terms &amp; Condition:</Text>
          <View style={{ marginTop: 5 }}>
            <Bullet>
              Please check the goods against this challan before signing.
            </Bullet>
            <Bullet>
              Any malfunctioning and mismatched products those need to be
              returned, you should contact us within 3 days after the delivery
              of the products.
            </Bullet>
            <Bullet>
              This challan is not a bill. It carries no prices, and no payment
              is due against it.
            </Bullet>
          </View>
        </View>

        <SignOffRow left="Delivered By" right="Received By" />
        <FooterBand />
      </Page>
    </Document>
  );
}

/**
 * The invoice's table with the three money columns taken out.
 *
 * Qty and Unit take the width the prices gave up rather than leaving a gap,
 * so the page does not read as an invoice someone cut a hole in.
 */
const CHALLAN_QTY = 1.1;
const CHALLAN_UNIT = 1.1;

function ChallanHead() {
  return (
    <View style={styles.trHead}>
      <Text style={[styles.th, col(COLS.sn)]}>S/N</Text>
      <Text style={[styles.th, col(COLS.product)]}>Product</Text>
      <Text style={[styles.th, col(COLS.brand)]}>Brand</Text>
      <Text style={[styles.th, col(COLS.spec)]}>Specification</Text>
      <Text style={[styles.th, col(CHALLAN_QTY)]}>Qty</Text>
      <Text style={[styles.th, col(CHALLAN_UNIT, true)]}>Unit</Text>
    </View>
  );
}

function ChallanRow({ line, n }: { line: DocumentLine; n: number }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, col(COLS.sn)]}>{n}</Text>
      <Text style={[styles.td, col(COLS.product)]}>{line.description}</Text>
      <Text style={[styles.td, col(COLS.brand)]}>{line.brandOrigin ?? ""}</Text>
      <Text style={[styles.td, col(COLS.spec)]}>
        {line.specification ?? ""}
      </Text>
      <Text style={[styles.td, styles.tdNum, col(CHALLAN_QTY)]}>
        {line.qty}
      </Text>
      <Text style={[styles.td, col(CHALLAN_UNIT, true)]}>
        {line.unit || "PCS"}
      </Text>
    </View>
  );
}
