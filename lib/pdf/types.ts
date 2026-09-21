import { formatTaka } from "./format";

/**
 * The data each printed document is built from.
 *
 * Kept apart from the renderer so the sales service, the payroll route and
 * the template engine can share the shapes without pulling react-pdf in.
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

/**
 * Does this table need a VAT column?
 *
 * Only when the lines disagree. One rate across the whole document is said
 * once in the totals block, and a column repeating it on every row is noise;
 * the moment two lines are taxed differently, a reader cannot reconcile the
 * total without seeing which line is which.
 */
export function needsVatColumn(lines: DocumentLine[]): boolean {
  const rates = lines.map((l) => l.vatRateBp ?? 0);
  return rates.length > 1 && rates.some((r) => r !== rates[0]);
}

/** A decrypted stamp image the renderer can draw. */
export type StampAsset = { data: Buffer; width: number; height: number };
export type StampAssets = Record<string, StampAsset>;

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

/**
 * One machine on an equipment order.
 *
 * Not a `DocumentLine`: the letter never tabulates these. It names them in a
 * sentence, puts the manufacturer in the terms and states one price — so the
 * fields are the ones a sentence needs, and `equipmentPrintedColumns` turns
 * one into a table line for the challan.
 */
export type EquipmentLine = {
  description: string;
  model?: string | null;
  manufacturer?: string | null;
  origin?: string | null;
  specification?: string | null;
  serialNo?: string | null;
  unitPriceMinor: number;
  qty: number;
  lineTotalMinor: number;
  vatRateBp?: number | null;
  vatMinor?: number | null;
};

/** The money an equipment document states, already priced by the order. */
export type EquipmentPricing = {
  subtotalMinor: number;
  discountMinor: number;
  vatRateBp: number;
  vatMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  /** Informational, never added: what the buyer is expected to withhold. */
  aitRateBp?: number;
  /** True when a line carries its own VAT, so no single rate can be named. */
  perLineVat?: boolean;
};

/**
 * The equipment quotation: a letter, not a table.
 *
 * `intro` is an override — when empty the template's own opening paragraph
 * prints, naming the equipment from the lines; when given it replaces it.
 */
export type EquipmentProposalData = EquipmentPricing & {
  proposalNo: string;
  date: Date;
  to: Party;
  subject: string;
  intro?: string | null;
  equipment: EquipmentLine[];
  terms: EquipmentTermsData;
  signatory: Signatory;
};

export type EquipmentTermsData = {
  payment: string;
  installation: string;
  warranty: string;
  afterWarranty: string;
  delivery: string;
  training: string;
  validityDays: number;
};

/** The equipment invoice: the same header as a sales invoice, one price in words. */
export type EquipmentInvoiceData = Omit<InvoiceData, "lines"> & {
  equipment: EquipmentLine[];
  perLineVat?: boolean;
};

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
 * A director's payslip for one month.
 *
 * States the basis openly — the month's revenue and the agreed percentage —
 * because that is the whole calculation, and a payslip that only showed the
 * final figure would be impossible to check.
 */
export type PayslipData = {
  month: string;
  monthLabel: string;
  employee: { name: string; code: string; designation: string };
  revenueMinor: number;
  onlineMinor: number;
  manualMinor: number;
  /**
   * The month's pool and this director's holding in it. Absent on a payslip
   * for a month computed under the percentage scheme, which carries `rateBp`
   * instead; a fixed salary carries neither.
   */
  pool?: {
    grossProfitMinor: number;
    orderCostsMinor: number;
    expensesMinor: number;
    aitMinor: number;
    netCashMinor: number;
    salariesMinor: number;
    distributableMinor: number;
    totalShares: number;
  } | null;
  shares?: number | null;
  rateBp: number | null;
  amountMinor: number;
  paidAt?: Date | null;
  reference?: string | null;
  approvedAt?: Date | null;
  signatory: Signatory;
};
