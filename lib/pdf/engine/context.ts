import { LEGAL, BANK, CONTACT, OFFICES } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import {
  aitOnGoods,
  namedVatRateBp,
  percentOf,
} from "@/lib/schemas/sales-order";
import {
  needsVatColumn,
  type ChallanData,
  type DocumentLine,
  type EquipmentAccessory,
  type EquipmentInvoiceData,
  type EquipmentLine,
  type EquipmentProposalData,
  type InvoiceData,
  type PayslipData,
  type ProposalData,
  type Signatory,
} from "../types";
import {
  accessoryQtyLabel,
  equipmentManufacturers,
  equipmentPrintedColumns,
  equipmentSetPhrase,
  equipmentSpecification,
  equipmentSummary,
} from "@/lib/sales/equipment";

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
function vatSuffix(lines: DocumentLine[], rateBp: number | null): string {
  return needsVatColumn(lines) || rateBp == null
    ? ""
    : ` (${percentOf(rateBp)}%)`;
}

/**
 * The rate an invoice's VAT was charged at, for its totals label.
 *
 * VAT typed on the lines is named by the lines' own rate when they all agree
 * — and by none when they differ, since the VAT column then says it line by
 * line. Only VAT charged on the order as a whole is named by the order's
 * rate (or what a typed figure comes to). The order's configured rate says
 * nothing about VAT typed on the lines: naming it printed "VAT (0%)" over a
 * VAT of 5% on every line.
 */
function invoiceVatRateBp(data: InvoiceData): number | null {
  const onLines = data.lines.some(
    (l) => (l.vatRateBp ?? 0) > 0 || (l.vatMinor ?? 0) > 0,
  );
  if (!onLines) return namedVatRateBp(data);
  const rates = [...new Set(data.lines.map((l) => l.vatRateBp ?? 0))];
  return rates.length === 1 ? rates[0] : null;
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
  // Goods after discount, before VAT — the one place that base is decided.
  // Display only: the template says so beside it, never added to the total.
  const aitMinor = aitOnGoods(
    data.subtotalMinor,
    data.discountMinor,
    data.aitRateBp ?? 0,
  );
  // The rate the VAT is named by: the lines' own when VAT was typed on them,
  // else the order's, or what a typed figure comes to on the goods.
  const vatRateBp = invoiceVatRateBp(data);
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
      ratePercent: vatRateBp == null ? null : vatRateBp / 100,
      rateSuffix: vatSuffix(data.lines, vatRateBp),
    },
    ait: { ratePercent: (data.aitRateBp ?? 0) / 100, amountMinor: aitMinor },
    terms: { paymentDays: data.paymentDays },
    bank: { ...BANK },
    company: companyContext(),
    signatory: data.signatory,
  };
}

/**
 * The machines, as the letter's placeholders reach them.
 *
 * `lines` is filled in too — mapped through the same columns the challan
 * prints — so a line table dropped into an equipment template by a
 * super-admin shows the equipment rather than nothing.
 */
function equipmentContext(
  equipment: EquipmentLine[],
  accessories: EquipmentAccessory[],
): {
  equipment: Record<string, unknown>;
  accessories: Record<string, unknown>[];
  lines: DocumentLine[];
} {
  const serials = equipment
    .map((l) => (l.serialNo ?? "").trim())
    .filter(Boolean);
  const machine = equipment[0];
  return {
    equipment: {
      summary: equipmentSummary(equipment),
      /** The machine as the table's bold row names it. */
      setName: equipmentSummary(equipment),
      /** "one set of X" — the object of the opening sentence. */
      setPhrase: equipmentSetPhrase(equipment),
      /** Read by the table itself, not by a placeholder. */
      setPriceMinor: equipment.reduce((n, l) => n + l.lineTotalMinor, 0),
      setQtyLabel: machine && machine.qty > 1 ? String(machine.qty) : "",
      names: equipment.map((l) => l.description.trim()).join(", "),
      models: equipment
        .map((l) => (l.model ?? "").trim())
        .filter(Boolean)
        .join(", "),
      manufacturers: equipmentManufacturers(equipment),
      specification: equipmentSpecification(equipment),
      serials: serials.join(", "),
      count: equipment.reduce((n, l) => n + l.qty, 0),
      /** "FCR Console, Drypix Edge" — the accessories in a sentence. */
      accessories: accessories.map((a) => a.description.trim()).join(", "),
      accessoryCount: accessories.length,
    },
    accessories: accessories.map((a) => ({
      name: a.description.trim(),
      spec: (a.specification ?? "").trim() || null,
      qty: accessoryQtyLabel(a),
      // The ROW's money, not the unit's: the price column has to add up to
      // the total beneath it, and the quantity is printed right beside it.
      priceMinor: a.priceMinor == null ? null : a.priceMinor * a.qty,
    })),
    lines: [
      ...equipment.map((l) => ({
        ...equipmentPrintedColumns(l, { serial: true }),
        unit: "unit",
        unitPriceMinor: l.unitPriceMinor,
        qty: l.qty,
        lineTotalMinor: l.lineTotalMinor,
        vatRateBp: l.vatRateBp ?? null,
        vatMinor: l.vatMinor ?? null,
      })),
      // The accessories are lines of the order too, so a line table dropped
      // into an equipment template by a super-admin lists the whole set.
      ...accessories.map((a) => ({
        description: a.description.trim(),
        brandOrigin: null,
        specification: (a.specification ?? "").trim() || null,
        unit: (a.unit ?? "").trim() || "set",
        unitPriceMinor: a.priceMinor ?? 0,
        qty: a.qty,
        lineTotalMinor: (a.priceMinor ?? 0) * a.qty,
        vatRateBp: null,
        vatMinor: null,
      })),
    ],
  };
}

/**
 * The rate "VAT (15%)" names on an equipment document.
 *
 * In per-line mode the order's configured rate says nothing about what was
 * charged, so the rate is the lines' own — and only when they all agree. A
 * VAT typed as a figure is named by what it comes to on the goods.
 */
function equipmentVatRate(data: {
  equipment: EquipmentLine[];
  perLineVat?: boolean;
  subtotalMinor: number;
  discountMinor: number;
  vatRateBp: number;
  vatAmountMinor?: number | null;
}): number | null {
  if (!data.perLineVat) return namedVatRateBp(data);
  const rates = [...new Set(data.equipment.map((l) => l.vatRateBp ?? 0))];
  return rates.length === 1 ? rates[0] : null;
}

const rateSuffix = (rateBp: number | null) =>
  rateBp == null ? "" : ` (${percentOf(rateBp)}%)`;

/**
 * The goods with their VAT — what the offer's table totals to once VAT is a
 * row of it, and what the words under that total have to say.
 */
function withVat(goodsMinor: number, vatMinor: number) {
  const withVatMinor = goodsMinor + vatMinor;
  return { withVatMinor, withVatInWords: amountInWords(withVatMinor) };
}

export function buildEquipmentProposalContext(
  data: EquipmentProposalData,
): RenderContext {
  const goodsMinor = Math.max(0, data.subtotalMinor - data.discountMinor);
  const vatRateBp = equipmentVatRate(data);
  const aitMinor = aitOnGoods(
    data.subtotalMinor,
    data.discountMinor,
    data.aitRateBp ?? 0,
  );
  const { equipment, accessories, lines } = equipmentContext(
    data.equipment,
    data.accessories,
  );
  return {
    proposalNo: data.proposalNo,
    date: data.date,
    subject: data.subject,
    intro: data.intro?.trim() || null,
    equipment,
    accessories,
    lines,
    price: {
      subtotalMinor: data.subtotalMinor,
      discountMinor: data.discountMinor,
      goodsMinor,
      goodsInWords: amountInWords(goodsMinor),
      vatMinor: data.vatMinor,
      vatPercent: vatRateBp == null ? null : vatRateBp / 100,
      vatSuffix: rateSuffix(vatRateBp),
      ...withVat(goodsMinor, data.vatMinor),
      deliveryMinor: data.deliveryMinor,
      totalMinor: data.totalMinor,
      totalInWords: amountInWords(data.totalMinor),
      hasExtras: data.vatMinor > 0 || data.deliveryMinor > 0,
      aitPercent: (data.aitRateBp ?? 0) / 100,
      aitMinor,
    },
    terms: { ...data.terms },
    to: { ...data.to },
    company: companyContext(),
    signatory: data.signatory,
  };
}

export function buildEquipmentInvoiceContext(
  data: EquipmentInvoiceData,
): RenderContext {
  const goodsMinor = Math.max(0, data.subtotalMinor - data.discountMinor);
  const balanceMinor = Math.max(0, data.totalMinor - data.paidMinor);
  const vatRateBp = equipmentVatRate(data);
  const aitMinor = aitOnGoods(
    data.subtotalMinor,
    data.discountMinor,
    data.aitRateBp ?? 0,
  );
  const { equipment, accessories, lines } = equipmentContext(
    data.equipment,
    data.accessories,
  );
  return {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    paymentDue: data.paymentDue,
    customerId: data.customerId ?? null,
    referenceNo: data.referenceNo ?? null,
    deliveryDate: data.deliveryDate ?? null,
    billTo: { ...data.billTo },
    equipment,
    accessories,
    lines,
    // The offer's table reads the same `price` object on both documents,
    // VAT row included.
    price: {
      goodsMinor,
      goodsInWords: amountInWords(goodsMinor),
      discountMinor: data.discountMinor,
      vatMinor: data.vatMinor,
      vatPercent: vatRateBp == null ? null : vatRateBp / 100,
      vatSuffix: rateSuffix(vatRateBp),
      ...withVat(goodsMinor, data.vatMinor),
    },
    totals: {
      subtotalMinor: data.subtotalMinor,
      discountMinor: data.discountMinor,
      goodsMinor,
      goodsInWords: amountInWords(goodsMinor),
      vatMinor: data.vatMinor,
      deliveryMinor: data.deliveryMinor,
      grandTotalMinor: data.totalMinor,
      amountInWords: amountInWords(data.totalMinor),
      hasExtras: data.vatMinor > 0 || data.deliveryMinor > 0,
      paidMinor: data.paidMinor,
      balanceMinor,
    },
    vat: {
      ratePercent: vatRateBp == null ? null : vatRateBp / 100,
      rateSuffix: rateSuffix(vatRateBp),
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
    // The shareholding basis. A payslip shows its working, so every step of
    // the pool is offered as a path even if a template prints only the last.
    hasShares: data.shares != null && data.pool != null,
    isFixed: data.shares == null && data.rateBp == null,
    shares: data.shares ?? null,
    poolShares: data.pool?.totalShares ?? null,
    holdingPercent:
      data.shares != null && data.pool && data.pool.totalShares > 0
        ? Math.round((data.shares / data.pool.totalShares) * 10000) / 100
        : null,
    pool: data.pool
      ? {
          grossProfitMinor: data.pool.grossProfitMinor,
          orderCostsMinor: data.pool.orderCostsMinor,
          expensesMinor: data.pool.expensesMinor,
          aitMinor: data.pool.aitMinor,
          netCashMinor: data.pool.netCashMinor,
          salariesMinor: data.pool.salariesMinor,
          distributableMinor: data.pool.distributableMinor,
        }
      : null,
    amountInWords: amountInWords(data.amountMinor),
    approvedAt: data.approvedAt ?? null,
    paidAt: data.paidAt ?? null,
    reference: data.reference ?? null,
    lines: [],
    company: companyContext(),
    signatory: data.signatory,
  };
}
