import type { TemplateKind } from "@/lib/schemas/pdf-template";

/**
 * What a `{{placeholder}}` in a template can refer to, per document kind.
 *
 * Client-safe: the editor reads this list to offer a field picker and to warn
 * about a path the document does not carry. The renderer reads it to know how
 * to format the value — poisha to grouped taka, a date to the stationery's
 * date style — so a template never has to say how a figure prints.
 */
export type PathKind =
  | "text"
  | "money"
  | "date"
  | "longDate"
  | "number"
  | "bool";

export type DataPath = { path: string; label: string; kind: PathKind };

const p = (path: string, label: string, kind: PathKind = "text"): DataPath => ({
  path,
  label,
  kind,
});

const COMPANY: DataPath[] = [
  p("company.name", "Company name"),
  p("company.bin", "Company BIN"),
  p("company.tin", "Company TIN"),
  p("company.phone", "Company phone"),
  p("company.email", "Company email"),
  p("company.website", "Company website"),
  p("company.headOfficeAddress", "Head office address"),
  p("company.regionalOfficeAddress", "Regional office address"),
];

const SIGNATORY: DataPath[] = [
  p("signatory.name", "Signatory name"),
  p("signatory.title", "Signatory title"),
  p("signatory.phone", "Signatory phone"),
  p("signatory.email", "Signatory email"),
];

const BANK: DataPath[] = [
  p("bank.bankName", "Bank name"),
  p("bank.accountName", "Bank account name"),
  p("bank.accountNo", "Bank account no"),
  p("bank.branch", "Bank branch"),
  p("bank.routingNo", "Bank routing no"),
  p("bank.mobileFinance", "Mobile finance service"),
];

const party = (prefix: string, label: string): DataPath[] => [
  p(`${prefix}.organisation`, `${label} organisation`),
  p(`${prefix}.address`, `${label} address`),
  p(`${prefix}.contactPerson`, `${label} contact person`),
  p(`${prefix}.attention`, `${label} attention`),
  p(`${prefix}.department`, `${label} department`),
  p(`${prefix}.phone`, `${label} phone`),
  p(`${prefix}.email`, `${label} email`),
];

export const DATA_PATHS: Record<TemplateKind, DataPath[]> = {
  proposal: [
    p("proposalNo", "Proposal number"),
    p("date", "Date", "longDate"),
    p("subject", "Subject"),
    p("intro", "Introduction"),
    p("terms.validityDays", "Validity (days)", "number"),
    p("terms.deliveryDays", "Delivery (days)", "number"),
    p("terms.paymentDays", "Payment (days)", "number"),
    p("terms.returnPolicy", "Return policy"),
    ...party("to", "Client"),
    p("vat.rateSuffix", "VAT rate suffix"),
    ...COMPANY,
    ...SIGNATORY,
  ],
  invoice: [
    p("invoiceNumber", "Invoice number"),
    p("invoiceDate", "Invoice date", "date"),
    p("paymentDue", "Payment due", "date"),
    p("customerId", "Customer ID"),
    p("referenceNo", "Reference / PO no"),
    p("deliveryDate", "Delivery date", "date"),
    ...party("billTo", "Client"),
    p("totals.totalQty", "Total quantity", "number"),
    p("totals.subtotalMinor", "Subtotal", "money"),
    p("totals.discountMinor", "Discount", "money"),
    p("totals.vatMinor", "VAT amount", "money"),
    p("totals.deliveryMinor", "Transport / delivery", "money"),
    p("totals.grandTotalMinor", "Grand total", "money"),
    p("totals.paidMinor", "Paid", "money"),
    p("totals.balanceMinor", "Balance due", "money"),
    p("totals.amountInWords", "Grand total in words"),
    p("vat.ratePercent", "VAT rate (%)", "number"),
    p("vat.rateSuffix", "VAT rate suffix"),
    p("ait.ratePercent", "AIT rate (%)", "number"),
    p("ait.amountMinor", "AIT amount", "money"),
    p("terms.paymentDays", "Payment (days)", "number"),
    ...BANK,
    ...COMPANY,
    ...SIGNATORY,
  ],
  challan: [
    p("challanNumber", "Challan number"),
    p("date", "Date", "date"),
    p("invoiceNumber", "Against invoice"),
    p("referenceNo", "Reference / PO no"),
    ...party("deliverTo", "Client"),
    p("dispatchNote", "Dispatch note"),
    p("totals.totalQty", "Total quantity", "number"),
    ...COMPANY,
    ...SIGNATORY,
  ],
  payslip: [
    p("month", "Month (YYYY-MM)"),
    p("monthLabel", "Month"),
    p("employee.name", "Employee name"),
    p("employee.code", "Employee code"),
    p("employee.designation", "Designation"),
    p("revenueMinor", "Total revenue", "money"),
    p("onlineMinor", "Website revenue", "money"),
    p("manualMinor", "Sales-order revenue", "money"),
    p("amountMinor", "Payable amount", "money"),
    p("ratePercent", "Agreed share (%) — percentage scheme", "number"),
    p("hasRate", "Was computed on a percentage", "bool"),
    p("hasShares", "Was computed on shares", "bool"),
    p("isFixed", "Is a fixed salary", "bool"),
    p("shares", "Shares held", "number"),
    p("poolShares", "Shares in the pool", "number"),
    p("holdingPercent", "Holding (% of the pool)", "number"),
    p("pool.grossProfitMinor", "Gross profit for the month", "money"),
    p("pool.orderCostsMinor", "Order costs", "money"),
    p("pool.expensesMinor", "Client visits", "money"),
    p("pool.aitMinor", "AIT withheld by clients", "money"),
    p("pool.netCashMinor", "Cash after AIT", "money"),
    p("pool.salariesMinor", "Fixed salaries", "money"),
    p("pool.distributableMinor", "Split between directors", "money"),
    p("amountInWords", "Payable in words"),
    p("approvedAt", "Approved on", "date"),
    p("paidAt", "Paid on", "date"),
    p("reference", "Payment reference"),
    ...COMPANY,
    ...SIGNATORY,
  ],
};

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Every `{{path}}` a text refers to, in order. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function pathKind(kind: TemplateKind, path: string): PathKind | null {
  return DATA_PATHS[kind].find((d) => d.path === path)?.kind ?? null;
}

export { PLACEHOLDER };
