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
};

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
  paymentDays: number;
  signatory: Signatory;
};

const col = (flex: number, last = false) => ({
  flex,
  ...(last ? { borderRightWidth: 0 } : {}),
});

/** The eight columns both documents share. */
const COLS = {
  sn: 0.45,
  product: 2.6,
  brand: 1.3,
  spec: 1.6,
  qty: 0.7,
  unit: 0.7,
  price: 1.1,
  total: 1.2,
};

function TableHead() {
  return (
    <View style={styles.tr}>
      <Text style={[styles.th, col(COLS.sn)]}>S/N</Text>
      <Text style={[styles.th, col(COLS.product)]}>Product</Text>
      <Text style={[styles.th, col(COLS.brand)]}>Brand</Text>
      <Text style={[styles.th, col(COLS.spec)]}>Specification</Text>
      <Text style={[styles.th, col(COLS.qty)]}>Qty</Text>
      <Text style={[styles.th, col(COLS.unit)]}>Unit</Text>
      <Text style={[styles.th, col(COLS.price)]}>Unit Price{"\n"}(BDT)</Text>
      <Text style={[styles.th, col(COLS.total, true)]}>
        Total Amount{"\n"}(BDT)
      </Text>
    </View>
  );
}

function LineRow({ line, n }: { line: DocumentLine; n: number }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, col(COLS.sn)]}>{n}</Text>
      <Text style={[styles.td, styles.tdText, col(COLS.product)]}>
        {line.description}
      </Text>
      <Text style={[styles.td, col(COLS.brand)]}>{line.brandOrigin ?? ""}</Text>
      <Text style={[styles.td, col(COLS.spec)]}>
        {line.specification ?? ""}
      </Text>
      <Text style={[styles.td, col(COLS.qty)]}>{line.qty}</Text>
      <Text style={[styles.td, col(COLS.unit)]}>{line.unit || "PCS"}</Text>
      <Text style={[styles.td, styles.tdNum, col(COLS.price)]}>
        {formatTaka(line.unitPriceMinor)}
      </Text>
      <Text style={[styles.td, styles.tdNum, col(COLS.total, true)]}>
        {formatTaka(line.lineTotalMinor)}
      </Text>
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
            {data.to.attention ? (
              <Field label="Attention:" value={data.to.attention} />
            ) : null}
            <Field label="Address:" value={data.to.address} />
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
          <TableHead />
          {data.lines.map((l, i) => (
            <LineRow key={i} line={l} n={i + 1} />
          ))}
        </View>

        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={styles.underlineLabel}>Terms &amp; Conditions:</Text>
          <View style={{ marginTop: 6 }}>
            <Bullet>Quality products and reliable product sourcing</Bullet>
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
          <TableHead />
          {data.lines.map((l, i) => (
            <LineRow key={i} line={l} n={i + 1} />
          ))}

          {/* The template's totals stack. Discount, VAT and Transport appear
              only when actually charged, so a plain invoice reads exactly like
              the scanned one. */}
          <TotalRow label="Total" value={String(totalQty)} unitsOnly />
          <TotalRow label="Subtotal" value={formatTaka(data.subtotalMinor)} />
          {data.discountMinor > 0 && (
            <TotalRow
              label="Discount"
              value={`−${formatTaka(data.discountMinor)}`}
            />
          )}
          {data.vatMinor > 0 && (
            <TotalRow
              label={`VAT (${data.vatRateBp / 100}%)`}
              value={formatTaka(data.vatMinor)}
            />
          )}
          {data.deliveryMinor > 0 && (
            <TotalRow
              label="Transport/ Delivery"
              value={formatTaka(data.deliveryMinor)}
            />
          )}
          <TotalRow label="Grand Total" value={formatTaka(data.totalMinor)} />
          {data.paidMinor > 0 && (
            <TotalRow label="Paid" value={formatTaka(data.paidMinor)} />
          )}
          <TotalRow
            label="Balance Due/ Outstanding"
            value={formatTaka(balanceMinor)}
            last
          />
        </View>

        <Text style={{ marginTop: 8 }}>
          <Text style={styles.underlineLabel}>Amount in Words:</Text>{" "}
          {amountInWords(data.totalMinor)}
        </Text>

        <View style={{ marginTop: 9 }} wrap={false}>
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

        <View style={{ marginTop: 9 }} wrap={false}>
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
 * A totals row: the first four columns stay ruled and empty, the label spans
 * Qty through Unit Price, and the figure sits under Total Amount.
 */
function TotalRow({
  label,
  value,
  last = false,
  unitsOnly = false,
}: {
  label: string;
  value: string;
  last?: boolean;
  unitsOnly?: boolean;
}) {
  return (
    <View style={last ? styles.trLast : styles.tr}>
      <Text style={[styles.td, col(COLS.sn)]} />
      <Text style={[styles.td, col(COLS.product)]} />
      <Text style={[styles.td, col(COLS.brand)]} />
      <Text style={[styles.td, col(COLS.spec)]} />
      <Text
        style={[
          styles.td,
          styles.tdNum,
          col(COLS.qty + COLS.unit + COLS.price),
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
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
