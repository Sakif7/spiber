import { LEGAL, BANK, CONTACT, OFFICES } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import {
  needsVatColumn,
  type ChallanData,
  type DocumentLine,
  type InvoiceData,
  type PayslipData,
  type ProposalData,
  type Signatory,
} from "../types";

/**
 * The render context: everything a template's placeholders can reach.
 *
 * Values are kept raw — a `Date`, an integer in poisha — and formatted at the
 * point of printing according to the path's declared kind (`paths.ts`), so
 * the same context serves a template that prints a date long-form and one
 * that prints it short.
 */
export type RenderContext = {
  lines: DocumentLine[];
  signatory?: Signatory;
  company: CompanyContext;
  [key: string]: unknown;
};

export type CompanyContext = {
  name: string;
  /** Prints a dash rather than nothing: a blank BIN line looks like an error. */
  bin: string;
  tin: string;
  phone: string;
  email: string;
  website: string;
  headOfficeAddress: string;
  regionalOfficeAddress: string;
};

export function companyContext(): CompanyContext {
  return {
    name: LEGAL.name,
    bin: LEGAL.bin || "—",
    tin: LEGAL.tin || "—",
    phone: CONTACT.phone,
    email: CONTACT.generalEmail,
    website: "www.spibermed.com",
    headOfficeAddress: OFFICES[0]?.address.en ?? "",
    regionalOfficeAddress: OFFICES[1]?.address.en ?? "",
  };
}

/** "VAT (15%)" in the totals — unless a per-line column already says. */
function vatSuffix(lines: DocumentLine[], rateBp: number): string {
  return needsVatColumn(lines) ? "" : ` (${rateBp / 100}%)`;
}

export function buildProposalContext(data: ProposalData): RenderContext {
  return {
    proposalNo: data.proposalNo,
    date: data.date,
    subject: data.subject,
    intro: data.intro,
    terms: { ...data.terms },
    to: { ...data.to },
    lines: data.lines,
    vat: { rateSuffix: "" },
    company: companyContext(),
    signatory: data.signatory,
  };
}

export function buildInvoiceContext(data: InvoiceData): RenderContext {
  const balanceMinor = Math.max(0, data.totalMinor - data.paidMinor);
  const totalQty = data.lines.reduce((n, l) => n + l.qty, 0);
  // Same base as the storefront invoice uses: the goods after any discount,
  // before VAT. Display only — the template says so beside it.
  const aitMinor = data.aitRateBp
    ? Math.round(
        ((data.subtotalMinor - data.discountMinor) * data.aitRateBp) / 10000,
      )
    : 0;
  return {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    paymentDue: data.paymentDue,
    customerId: data.customerId ?? null,
    referenceNo: data.referenceNo ?? null,
    deliveryDate: data.deliveryDate ?? null,
    billTo: { ...data.billTo },
    lines: data.lines,
    totals: {
      totalQty,
      subtotalMinor: data.subtotalMinor,
      discountMinor: data.discountMinor,
      vatMinor: data.vatMinor,
      deliveryMinor: data.deliveryMinor,
      grandTotalMinor: data.totalMinor,
      paidMinor: data.paidMinor,
      balanceMinor,
      amountInWords: amountInWords(data.totalMinor),
    },
    vat: {
      ratePercent: data.vatRateBp / 100,
      rateSuffix: vatSuffix(data.lines, data.vatRateBp),
    },
    ait: { ratePercent: (data.aitRateBp ?? 0) / 100, amountMinor: aitMinor },
    terms: { paymentDays: data.paymentDays },
    bank: { ...BANK },
    company: companyContext(),
    signatory: data.signatory,
  };
}

export function buildChallanContext(data: ChallanData): RenderContext {
  return {
    challanNumber: data.challanNumber,
    date: data.date,
    invoiceNumber: data.invoiceNumber ?? null,
    referenceNo: data.referenceNo ?? null,
    deliverTo: { ...data.deliverTo },
    lines: data.lines,
    dispatchNote: data.dispatchNote ?? null,
    totals: { totalQty: data.lines.reduce((n, l) => n + l.qty, 0) },
    company: companyContext(),
  };
}

export function buildPayslipContext(data: PayslipData): RenderContext {
  return {
    month: data.month,
    monthLabel: data.monthLabel,
    employee: { ...data.employee },
    revenueMinor: data.revenueMinor,
    onlineMinor: data.onlineMinor,
    manualMinor: data.manualMinor,
    amountMinor: data.amountMinor,
    ratePercent: data.rateBp != null ? data.rateBp / 100 : null,
    hasRate: data.rateBp != null,
    amountInWords: amountInWords(data.amountMinor),
    approvedAt: data.approvedAt ?? null,
    paidAt: data.paidAt ?? null,
    reference: data.reference ?? null,
    lines: [],
    company: companyContext(),
    signatory: data.signatory,
  };
}
