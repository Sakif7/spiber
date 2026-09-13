import React from "react";
import type { TemplateDoc, TemplateKind } from "@/lib/schemas/pdf-template";
import {
  buildChallanContext,
  buildInvoiceContext,
  buildPayslipContext,
  buildProposalContext,
} from "./context";
import { TemplateDocument, type BlockBox } from "./render-template";
import type {
  ChallanData,
  DocumentLine,
  InvoiceData,
  PayslipData,
  ProposalData,
  StampAssets,
} from "../types";

/**
 * Sample data the template editor previews with.
 *
 * Deliberately made up: the preview route renders whatever a super-admin is
 * editing, and no client's pricing should ever be what it shows. The samples
 * exercise every conditional — mixed VAT rates, a discount, AIT, a dispatch
 * note — so an edit to a hidden-when-empty line can be seen.
 */

const signatory = {
  name: "Dr. Md Jahidul Islam",
  title: "Managing Director",
  phone: "+880 1346 092798",
  email: "md@spibermed.com",
};

const lines: DocumentLine[] = [
  {
    description: "12-Channel ECG Machine",
    brandOrigin: "Contec, China",
    specification:
      "Channels: 12 · Display: 7-inch colour TFT · Warranty: 2 years",
    unit: "pcs",
    unitPriceMinor: 4_50_000_00,
    qty: 2,
    lineTotalMinor: 9_00_000_00,
    vatRateBp: 1500,
    vatMinor: 1_35_000_00,
  },
  {
    description: "IV Cannula",
    brandOrigin: "Venflon, Malaysia",
    specification: "18, 20, 22 G",
    unit: "pcs",
    unitPriceMinor: 85_00,
    qty: 200,
    lineTotalMinor: 17_000_00,
    vatRateBp: 500,
    vatMinor: 850_00,
  },
  {
    description: "Foley's Catheter",
    brandOrigin: "Bardia",
    specification: "12, 18, 20 FR (2 way)",
    unit: "pcs",
    unitPriceMinor: 190_00,
    qty: 50,
    lineTotalMinor: 9_500_00,
    vatRateBp: 500,
    vatMinor: 475_00,
  },
];

const party = {
  organisation: "Popular Diagnostic Centre",
  address: "House 16, Road 2, Dhanmondi, Dhaka-1205",
  contactPerson: "Head of Procurement",
  attention: "Head of Procurement",
  department: "Procurement",
  phone: "+880 1711 223344",
  email: "procurement@example.test",
};

const subtotal = lines.reduce((n, l) => n + l.lineTotalMinor, 0);
const vat = lines.reduce((n, l) => n + (l.vatMinor ?? 0), 0);
const discount = 10_000_00;
const delivery = 2_500_00;

export const FIXTURE_PROPOSAL: ProposalData = {
  proposalNo: "SPM-SO-SAMPLE-001",
  date: new Date("2026-09-08T06:00:00Z"),
  to: party,
  subject: "Proposal for Medical Equipment and Surgical Consumables",
  intro:
    "Thank you for giving us the opportunity to quote our medical equipment and disposable products for your esteemed organisation; we are pleased to offer the items below.",
  lines,
  terms: { deliveryDays: 2, validityDays: 7, paymentDays: 30 },
  signatory,
};

export const FIXTURE_INVOICE: InvoiceData = {
  invoiceNumber: "SPIBER/PDC/8-9/26-101",
  invoiceDate: new Date("2026-09-08T06:00:00Z"),
  paymentDue: new Date("2026-10-08T06:00:00Z"),
  customerId: "CUS-PDC",
  referenceNo: "PO-2026-0471",
  deliveryDate: new Date("2026-09-10T06:00:00Z"),
  billTo: party,
  lines,
  subtotalMinor: subtotal,
  discountMinor: discount,
  vatRateBp: 1500,
  vatMinor: vat,
  deliveryMinor: delivery,
  totalMinor: subtotal - discount + vat + delivery,
  paidMinor: 0,
  aitRateBp: 500,
  paymentDays: 30,
  signatory,
};

export const FIXTURE_CHALLAN: ChallanData = {
  challanNumber: "SPIBER/DC/PDC/10-9/26-14",
  date: new Date("2026-09-10T06:00:00Z"),
  invoiceNumber: "SPIBER/PDC/8-9/26-101",
  referenceNo: "PO-2026-0471",
  deliverTo: party,
  lines,
  dispatchNote: "Dhaka Metro-Ta 11-2233, driver Mr. Rahim",
};

export const FIXTURE_PAYSLIP: PayslipData = {
  month: "2026-08",
  monthLabel: "August 2026",
  employee: {
    name: "Dr. Md Jahidul Islam",
    code: "EMP-001",
    designation: "Managing Director",
  },
  revenueMinor: 1_00_00_000,
  onlineMinor: 40_00_000,
  manualMinor: 60_00_000,
  // 2,000 of 14,000 shares of a 4,20,000 pool = 60,000.
  pool: {
    grossProfitMinor: 5_50_000_00 / 100,
    orderCostsMinor: 30_000_00 / 100,
    expensesMinor: 10_000_00 / 100,
    aitMinor: 40_000_00 / 100,
    netCashMinor: 4_70_000_00 / 100,
    salariesMinor: 50_000_00 / 100,
    distributableMinor: 4_20_000_00 / 100,
    totalShares: 14_000,
  },
  shares: 2_000,
  rateBp: null,
  amountMinor: 60_000_00 / 100,
  approvedAt: new Date("2026-09-03T06:00:00Z"),
  paidAt: new Date("2026-09-05T06:00:00Z"),
  reference: "TRX-88",
  signatory,
};

function fixtureContext(kind: TemplateKind) {
  switch (kind) {
    case "proposal":
      return buildProposalContext(FIXTURE_PROPOSAL);
    case "invoice":
      return buildInvoiceContext(FIXTURE_INVOICE);
    case "challan":
      return buildChallanContext(FIXTURE_CHALLAN);
    case "payslip":
      return buildPayslipContext(FIXTURE_PAYSLIP);
  }
}

/**
 * The element to render for a preview of `template` as document `kind`.
 * `onLayout` receives where each block landed, for the editor's position pad.
 */
export function fixtureElement(
  kind: TemplateKind,
  template: TemplateDoc,
  assets: StampAssets = {},
  onLayout?: (boxes: BlockBox[]) => void,
): React.ReactElement {
  return React.createElement(TemplateDocument, {
    kind,
    template,
    ctx: fixtureContext(kind),
    assets,
    onLayout,
  });
}
