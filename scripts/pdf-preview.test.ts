/**
 * Render the proposal and the invoice with sample data, so the letterhead and
 * watermark can be looked at rather than guessed at.
 * Run with: npm run pdf-preview
 */
import { it } from "vitest";
import fs from "node:fs";
import { renderPdf } from "@/lib/pdf/render";
import { ProposalDocument, InvoiceDocument } from "@/lib/pdf/documents";

const OUT = "public/_preview";
fs.mkdirSync(OUT, { recursive: true });

const lines = [
  {
    description: "12-Channel ECG Machine",
    brandOrigin: "",
    specification: "Channels: 12 · Display: 7-inch color TFT",
    unit: "pcs",
    unitPriceMinor: 40000,
    qty: 1,
    lineTotalMinor: 40000,
  },
  {
    description: "Air Fryer 5L",
    brandOrigin: "",
    specification:
      "Type: Digital air fryer · Capacity: 5 litres · Power: 1500 W · Temperature: 80–200°C · Warranty: 2 years",
    unit: "pcs",
    unitPriceMinor: 720000,
    qty: 1,
    lineTotalMinor: 720000,
  },
];

const to = {
  organisation: "Popular Diagnostic Centre",
  address: "House 16, Road 2, Dhanmondi, Dhaka-1205",
  attention: "Head of Procurement",
  phone: "+880 1711 223344",
  email: "procurement@example.test",
};

const signatory = {
  name: "Dr. Md Jahidul Islam",
  title: "Managing Director & CEO",
  phone: "+880 1346 092798",
  email: "info@spibermed.com",
};

const terms = { deliveryDays: 2, validityDays: 7, paymentDays: 30 };

it("renders the proposal and the invoice for inspection", async () => {
  const proposal = await renderPdf(
    ProposalDocument({
      data: {
        proposalNo: "SPM-SO-MTSS114J-67URM",
        date: new Date("2026-09-08"),
        to,
        subject: "Proposal for Medical and Surgical Consumables",
        intro:
          "Thank you for giving us the opportunity to quote our Medical Disposable product within your esteemed organization; we are very much pleased to offer our Surgical Items as follows;",
        lines,
        terms,
        signatory,
      },
    }) as never,
  );
  fs.writeFileSync(OUT + "/proposal.pdf", proposal);

  const invoice = await renderPdf(
    InvoiceDocument({
      data: {
        invoiceNumber: "SPIBER/EWMCH/14-8/26-714",
        invoiceDate: new Date("2026-09-08"),
        paymentDue: new Date("2026-10-08"),
        referenceNo: null,
        billTo: to,
        lines,
        subtotalMinor: 760000,
        discountMinor: 0,
        vatRateBp: 1500,
        vatMinor: 114000,
        deliveryMinor: 0,
        totalMinor: 874000,
        paidMinor: 0,
        paymentDays: 30,
        signatory,
      },
    }) as never,
  );
  fs.writeFileSync(OUT + "/invoice.pdf", invoice);

  console.log("wrote proposal.pdf and invoice.pdf");
}, 60000);
