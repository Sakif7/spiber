import React from "react";
import { logger } from "@/lib/log";
import { CONTACT } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import { renderFitted } from "@/lib/pdf/render";
import { addDays } from "@/lib/pdf/format";
import {
  ProposalDocument,
  InvoiceDocument,
  ChallanDocument,
  EquipmentProposalDocument,
  EquipmentInvoiceDocument,
  type DocumentLine,
  type EquipmentAccessory,
  type EquipmentLine,
  type Signatory,
} from "@/lib/pdf/documents";
import {
  accessoriesOf,
  completeEquipmentTerms,
  equipmentPrintedColumns,
  equipmentSummary,
  machineLinesOf,
  orderKindOf,
} from "@/lib/sales/equipment";
import type { TemplateKind } from "@/lib/schemas/pdf-template";
import type { ISalesOrder, IDocumentVersion } from "@/lib/models/salesOrder";
import type { Lean } from "@/lib/models/_shared";
import { getSetting } from "@/lib/repositories/settings.repo";
import { getMailer } from "@/lib/mailer";
import { salesEmails } from "./sales-emails";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import {
  getSalesOrderById,
  getSalesLeadById,
  updateSalesOrder,
  addSalesOrderActivity,
  markVersionEmailed,
} from "@/lib/repositories/sales.repo";
import {
  nextInvoiceSeq,
  formatInvoiceNumber,
} from "@/lib/services/invoice-number.service";
import {
  ensureFolderPath,
  uploadDocument,
  type Actor,
} from "@/lib/services/company-fs.service";
import { vaultConfigured } from "@/lib/crypto/vault";
import {
  getCurrentTemplate,
  getTemplateForRender,
} from "@/lib/services/pdf-template.service";
import { aitOnGoods, effectiveVatRateBp } from "@/lib/schemas/sales-order";
import {
  nextChallanSeq,
  formatChallanNumber,
} from "@/lib/services/invoice-number.service";
import type {
  ProposalGenerateInput,
  InvoiceGenerateInput,
  ChallanGenerateInput,
  SendDocumentInput,
} from "@/lib/schemas/sales-order";

/**
 * Generating, filing and sending the proposal and the invoice.
 *
 * Each generation stores an immutable SNAPSHOT of what the document said, and
 * files the PDF into the company vault. That is deliberate: a client holds a
 * printed copy, so an amended order must not silently change what was already
 * sent — the old version stays reproducible, marked superseded.
 */

export type DocKind = "proposal" | "invoice" | "challan";

export type DocError =
  | "not_found"
  | "vault_not_configured"
  | "no_items"
  | "no_price"
  | "not_invoiced"
  | "recipient_mismatch"
  | "no_recipient";

export type DocResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DocError };

const fail = (code: DocError): DocResult<never> => ({ ok: false, code });
const done = <T>(data: T): DocResult<T> => ({ ok: true, data });

/** Who signs the documents. Configurable, because the MD is not forever. */
async function signatory(): Promise<Signatory> {
  const stored = await getSetting<Partial<Signatory>>("sales.signatory").catch(
    () => null,
  );
  return {
    name: stored?.name ?? "Dr. Md Jahidul Islam",
    title: stored?.title ?? "Managing Director",
    phone: stored?.phone ?? CONTACT.phone,
    email: stored?.email ?? "md@spibermed.com",
  };
}

/** A document records what was quoted, never how much stock it holds. */
function stripReservation(item: ISalesOrder["items"][number]) {
  const { reservedQty, ...rest } = item;
  void reservedQty;
  return rest;
}

/**
 * The lines a document prints.
 *
 * `quantityMode: "single"` quotes one of each at the unit rate, which is what a
 * proposal usually is — the price per piece, for the client to order against.
 * The stored order keeps the quantities that were entered either way; this
 * only changes what the paper says.
 */
/**
 * The printed text columns of a line.
 *
 * A consumables line prints as entered. An equipment line folds its model —
 * and, on the challan, its serial number — into the columns the shared
 * table already has, so the challan's layout is the same for both kinds.
 */
const printedColumns = (
  order: Pick<Lean<ISalesOrder>, "kind">,
  i: Pick<
    ISalesOrder["items"][number],
    | "description"
    | "brandOrigin"
    | "specification"
    | "model"
    | "manufacturer"
    | "origin"
    | "serialNo"
    | "qty"
  >,
  opts: { serial?: boolean },
) =>
  orderKindOf(order) === "equipment"
    ? equipmentPrintedColumns(i, { serial: opts.serial })
    : {
        description: i.description,
        brandOrigin: i.brandOrigin ?? null,
        specification: i.specification ?? null,
      };

/**
 * The machine an equipment order is for, as the price offer reads it.
 *
 * Only the lines that are not accessories — one of them, on any order the
 * current rules allowed — so the table's bold row names the set and prices
 * it, and the accessories are numbered beneath.
 */
const toEquipment = (
  all: Omit<ISalesOrder["items"][number], "reservedQty">[],
): EquipmentLine[] =>
  machineLinesOf(all).map((i) => ({
    description: i.description,
    model: i.model ?? null,
    manufacturer: i.manufacturer ?? null,
    origin: i.origin ?? null,
    specification: i.specification ?? null,
    serialNo: i.serialNo ?? null,
    unitPriceMinor: i.unitPriceMinor,
    qty: i.qty,
    lineTotalMinor: i.lineTotalMinor,
    vatRateBp: effectiveVatRateBp(i),
    vatMinor: i.vatMinor ?? 0,
  }));

/** The accessories listed under the machine, in the order they were added. */
const toAccessories = (
  all: Omit<ISalesOrder["items"][number], "reservedQty">[],
): EquipmentAccessory[] =>
  accessoriesOf(all).map((i) => ({
    description: i.description,
    specification: i.specification ?? null,
    qty: i.qty,
    unit: i.unit ?? null,
    // Zero is "the set price covers it": the offer prints an empty cell
    // rather than a free-of-charge figure nobody typed.
    priceMinor: i.unitPriceMinor > 0 ? i.unitPriceMinor : null,
  }));

/** Has any line its own VAT, taking the order off the configured rate? */
const hasPerLineVat = (
  items: Pick<ISalesOrder["items"][number], "vatRateBp" | "vatAmountMinor">[],
) => items.some((i) => i.vatRateBp != null || i.vatAmountMinor != null);

const toLines = (
  order: Lean<ISalesOrder>,
  quantityMode: "single" | "ordered" = "ordered",
  opts: { serial?: boolean } = {},
): DocumentLine[] =>
  order.items.map((i) => {
    const qty = quantityMode === "single" ? 1 : i.qty;
    const lineTotalMinor = i.unitPriceMinor * qty;
    const rateBp = effectiveVatRateBp(i);
    return {
      ...printedColumns(order, i, opts),
      unit: i.unit ?? null,
      unitPriceMinor: i.unitPriceMinor,
      qty,
      lineTotalMinor,
      vatRateBp: rateBp,
      // At the ordered quantity, print the figure the order was priced with —
      // a VAT typed as an amount must not drift by a poisha through a
      // round-trip via its implied rate. A quote-per-piece proposal is showing
      // a different quantity, so there the rate is what carries over.
      vatMinor:
        qty === i.qty
          ? (i.vatMinor ?? 0)
          : Math.round((lineTotalMinor * rateBp) / 10000),
    };
  });

/**
 * File a generated PDF in the vault, under Sales / <organisation> / <kind>s.
 *
 * Best-effort by design: the document has already been produced and the order
 * must not be blocked because the archive is unavailable. A failure is logged
 * and the version simply has no vault link.
 */
/** Where each kind is filed in the company vault. */
const VAULT_FOLDER: Record<DocKind, string> = {
  proposal: "Proposals",
  invoice: "Invoices",
  challan: "Delivery challans",
};

async function fileInVault(
  order: Lean<ISalesOrder>,
  kind: DocKind,
  filename: string,
  pdf: Buffer,
  actor: Actor,
): Promise<string | null> {
  try {
    const folder = await ensureFolderPath(
      ["Sales", order.leadSnapshot.organisation, VAULT_FOLDER[kind]],
      actor,
    );
    if (!folder.ok) return null;
    const stored = await uploadDocument(
      {
        filename,
        contentType: "application/pdf",
        body: pdf,
        folderId: folder.data.id,
        source: { kind: "salesOrder", id: String(order._id) },
      },
      actor,
    );
    return stored.ok ? stored.id : null;
  } catch (e) {
    logger.warn("sales: could not file the document in the vault", e);
    return null;
  }
}

// ─────────────────────────── proposal ───────────────────────────

export async function generateProposal(
  orderId: string,
  input: ProposalGenerateInput,
  actor: Actor,
): Promise<DocResult<{ version: number; documentId: string | null }>> {
  if (!vaultConfigured()) return fail("vault_not_configured");
  const order = await getSalesOrderById(orderId);
  if (!order) return fail("not_found");
  if (order.items.length === 0) return fail("no_items");

  const lead = await getSalesLeadById(String(order.leadId));
  const version = order.proposals.length + 1;
  const equipment = orderKindOf(order) === "equipment";
  // An equipment letter names the machines and states one price; there is
  // no per-piece quotation to choose.
  const quantityMode = equipment
    ? "ordered"
    : (input.quantityMode ?? "ordered");
  const date = new Date();
  const terms = { ...order.terms, ...(input.terms ?? {}) };
  const machines = equipment ? toEquipment(order.items) : [];
  const subject =
    input.subject?.trim() ||
    (equipment
      ? `Price Offer for ${equipmentSummary(machines)}`
      : "Proposal for Medical and Surgical Consumables");
  // On the letter the standard opening lives in the template, so a blank
  // here means "print the template's"; the consumables proposal keeps its
  // wording here as it always has.
  const intro = equipment
    ? input.intro?.trim() || null
    : input.intro?.trim() ||
      "Thank you for giving us the opportunity to quote our Medical Disposable product within your esteemed organization; we are very much pleased to offer our Surgical Items as follows;";
  const equipmentTerms = equipment
    ? completeEquipmentTerms(input.equipmentTerms)
    : null;
  const addressee = {
    title: input.addresseeTitle?.trim() || lead?.addresseeTitle || null,
    dept: input.addresseeDept?.trim() || lead?.addresseeDept || null,
    organisation: order.leadSnapshot.organisation,
    address: order.leadSnapshot.address,
  };
  /** The template's "Proposal To" block. */
  const proposalTo = {
    organisation: order.leadSnapshot.organisation,
    address: order.leadSnapshot.address,
    department: addressee.dept,
    attention: addressee.title || order.leadSnapshot.contactName,
    phone: order.leadSnapshot.phone ?? null,
    email: order.leadSnapshot.email ?? null,
  };

  const tpl = await getCurrentTemplate(
    equipment ? "equipmentProposal" : "proposal",
  );
  const who = await signatory();
  const pdf = await renderFitted((fit) =>
    equipment && equipmentTerms
      ? React.createElement(EquipmentProposalDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: {
            proposalNo: order.number,
            date,
            to: proposalTo,
            subject,
            intro,
            equipment: machines,
            accessories: toAccessories(order.items),
            subtotalMinor: order.subtotalMinor,
            discountMinor: order.discountMinor,
            vatRateBp: order.vatRateBp,
            vatAmountMinor: order.vatAmountMinor ?? null,
            vatMinor: order.vatMinor,
            deliveryMinor: order.deliveryMinor ?? 0,
            totalMinor: order.totalMinor,
            aitRateBp: order.aitRateBp ?? 0,
            perLineVat: hasPerLineVat(order.items),
            terms: { ...equipmentTerms, validityDays: terms.validityDays },
            signatory: who,
          },
        })
      : React.createElement(ProposalDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: {
            proposalNo: order.number,
            date,
            to: proposalTo,
            subject,
            intro: intro ?? "",
            lines: toLines(order, quantityMode),
            terms,
            signatory: who,
          },
        }),
  );

  const filename = `Proposal ${order.number} v${version}.pdf`;
  const documentId = await fileInVault(order, "proposal", filename, pdf, actor);

  const entry: IDocumentVersion = {
    version,
    generatedAt: date,
    generatedBy: actor.sub,
    snapshot: {
      items: order.items.map(stripReservation),
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      deliveryMinor: order.deliveryMinor ?? 0,
      vatRateBp: order.vatRateBp,
      vatAmountMinor: order.vatAmountMinor ?? null,
      vatMinor: order.vatMinor,
      aitRateBp: order.aitRateBp ?? 0,
      totalMinor: order.totalMinor,
      terms,
      addressee,
      subject,
      intro,
      equipmentTerms,
      quantityMode,
    },
    documentId,
    emailedTo: [],
    templateRef: { kind: tpl.kind, version: tpl.version },
  };
  // Any earlier proposal is superseded, exactly as an earlier invoice is: two
  // unmarked proposals side by side is how the wrong one gets sent.
  const proposals = order.proposals.map((v) =>
    v.supersededAt ? v : { ...v, supersededAt: new Date() },
  );
  proposals.push(entry);
  await updateSalesOrder(orderId, { proposals });
  if (order.status === "draft") {
    await updateSalesOrder(orderId, { status: "proposal_generated" });
  }
  await addSalesOrderActivity(orderId, {
    authorId: actor.sub,
    body: `Proposal v${version} generated`,
  });

  return done({ version, documentId });
}

// ─────────────────────────── invoice ───────────────────────────

/**
 * Produce an invoice for an already-invoiced order.
 *
 * Called by the transition (which reserves the stock first) and again whenever
 * the order is amended, so a corrected invoice gets a NEW number and the old
 * version is marked superseded rather than rewritten.
 */
/**
 * The AIT we expect the client to keep back, recorded as the invoice goes out.
 *
 * The order carries the rate the client quoted, and until now that rate only
 * printed on the paper — the report read a separate `withholding` record that
 * a second, easily-missed menu action had to write, so a bill sent at 5% showed
 * zero AIT withheld until someone remembered. Issuing the invoice is the moment
 * the expectation becomes real, so it is written here.
 *
 * A figure a person entered from the client's deduction slip is `confirmed` and
 * is never touched: regenerating a corrected invoice refreshes only our own
 * expectation. Returns nothing to change when there is no rate, which leaves an
 * order with no AIT exactly as it was.
 */
function expectedWithholding(
  order: Lean<ISalesOrder>,
  actor: Actor,
): Partial<Pick<ISalesOrder, "withholding">> {
  const rateBp = order.aitRateBp ?? 0;
  const existing = order.withholding;
  if (existing && (existing.source ?? "confirmed") === "confirmed") return {};
  if (!rateBp) return existing ? { withholding: null } : {};

  return {
    withholding: {
      aitRateBp: rateBp,
      aitMinor: aitOnGoods(order.subtotalMinor, order.discountMinor, rateBp),
      vdsMinor: existing?.vdsMinor ?? null,
      certificateReceived: existing?.certificateReceived ?? false,
      certificateRef: existing?.certificateRef ?? null,
      note: existing?.note ?? null,
      source: "expected",
      recordedAt: new Date(),
      recordedBy: actor.sub,
    },
  };
}

export async function generateInvoice(
  orderId: string,
  input: InvoiceGenerateInput,
  actor: Actor,
): Promise<
  DocResult<{
    version: number;
    invoiceNumber: string;
    documentId: string | null;
  }>
> {
  if (!vaultConfigured()) return fail("vault_not_configured");
  const order = await getSalesOrderById(orderId);
  if (!order) return fail("not_found");
  if (order.items.length === 0) return fail("no_items");
  if (order.status !== "invoiced" && order.status !== "delivered") {
    return fail("not_invoiced");
  }

  const version = order.invoices.length + 1;
  const invoiceDate = input.invoiceDate
    ? new Date(input.invoiceDate)
    : new Date();
  const deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
  const paymentDays = input.paymentDays ?? order.terms.paymentDays;

  /**
   * One order, one invoice number.
   *
   * A correction becomes a new VERSION of the same invoice rather than a new
   * invoice, so the client's accounts payable sees a single number for a single
   * order. The counter therefore only advances the first time an order is
   * invoiced; regenerating reuses the number already issued.
   */
  const invoiceNumber =
    order.invoiceNumber ??
    formatInvoiceNumber({
      code: order.leadSnapshot.code,
      date: invoiceDate,
      seq: await nextInvoiceSeq(),
    });

  const equipment = orderKindOf(order) === "equipment";
  // A price offer may go out before the figure is agreed; a bill may not.
  // Nothing downstream — the report, payroll, the client's own ledger —
  // can tell an invoice that is genuinely free from one nobody priced.
  if (equipment && order.totalMinor <= 0) return fail("no_price");
  const tpl = await getCurrentTemplate(
    equipment ? "equipmentInvoice" : "invoice",
  );
  const invoiceData = {
    invoiceNumber,
    invoiceDate,
    paymentDue: addDays(invoiceDate, paymentDays),
    // The client's own code doubles as their customer reference; it is
    // already the segment inside the invoice number.
    customerId: order.leadSnapshot.code
      ? `CUS-${order.leadSnapshot.code}`
      : null,
    referenceNo: order.referenceNo ?? null,
    deliveryDate,
    billTo: {
      organisation: order.leadSnapshot.organisation,
      address: order.leadSnapshot.address,
      contactPerson: order.leadSnapshot.contactName ?? null,
      phone: order.leadSnapshot.phone ?? null,
      email: order.leadSnapshot.email ?? null,
    },
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    vatRateBp: order.vatRateBp,
    vatAmountMinor: order.vatAmountMinor ?? null,
    vatMinor: order.vatMinor,
    deliveryMinor: order.deliveryMinor ?? 0,
    totalMinor: order.totalMinor,
    aitRateBp: order.aitRateBp ?? 0,
    // Only whole-order payment is tracked, so this is all or nothing.
    paidMinor: order.payment.status === "paid" ? order.totalMinor : 0,
    paymentDays,
    signatory: await signatory(),
  };
  const pdf = await renderFitted((fit) =>
    equipment
      ? React.createElement(EquipmentInvoiceDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: {
            ...invoiceData,
            equipment: toEquipment(order.items),
            accessories: toAccessories(order.items),
            perLineVat: hasPerLineVat(order.items),
          },
        })
      : React.createElement(InvoiceDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: { ...invoiceData, lines: toLines(order) },
        }),
  );

  const filename = `Invoice ${invoiceNumber.replace(/\//g, "-")}.pdf`;
  const documentId = await fileInVault(order, "invoice", filename, pdf, actor);

  // Any earlier invoice a client holds is superseded, never rewritten.
  const invoices = order.invoices.map((v) =>
    v.supersededAt ? v : { ...v, supersededAt: new Date() },
  );
  invoices.push({
    version,
    generatedAt: new Date(),
    generatedBy: actor.sub,
    snapshot: {
      items: order.items.map(stripReservation),
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      deliveryMinor: order.deliveryMinor ?? 0,
      vatRateBp: order.vatRateBp,
      vatAmountMinor: order.vatAmountMinor ?? null,
      vatMinor: order.vatMinor,
      aitRateBp: order.aitRateBp ?? 0,
      totalMinor: order.totalMinor,
      paidMinor: order.payment.status === "paid" ? order.totalMinor : 0,
      referenceNo: order.referenceNo ?? null,
      customerId: order.leadSnapshot.code
        ? `CUS-${order.leadSnapshot.code}`
        : null,
      terms: { ...order.terms, paymentDays },
      invoiceNumber,
      invoiceDate,
      deliveryDate,
      amountInWords: amountInWords(order.totalMinor),
    },
    documentId,
    emailedTo: [],
    templateRef: { kind: tpl.kind, version: tpl.version },
  });

  await updateSalesOrder(orderId, {
    invoices,
    invoiceNumber,
    invoicedAt: order.invoicedAt ?? invoiceDate,
    ...expectedWithholding(order, actor),
  });
  await addSalesOrderActivity(orderId, {
    authorId: actor.sub,
    body: `Invoice ${invoiceNumber} generated (v${version})`,
  });

  return done({ version, invoiceNumber, documentId });
}

// ─────────────────────────── delivery challan ───────────────────────────

/**
 * Produce the note that travels with the goods.
 *
 * Available once the order is invoiced, because a challan without an invoice
 * behind it is stock leaving the building against nothing. One number per
 * order: producing it again — to add a vehicle registration, say — supersedes
 * the previous version rather than issuing a second challan, since two
 * challans for one delivery is how goods get counted twice at the gate.
 */
export async function generateChallan(
  orderId: string,
  input: ChallanGenerateInput,
  actor: Actor,
): Promise<
  DocResult<{
    version: number;
    challanNumber: string;
    documentId: string | null;
  }>
> {
  if (!vaultConfigured()) return fail("vault_not_configured");
  const order = await getSalesOrderById(orderId);
  if (!order) return fail("not_found");
  if (order.items.length === 0) return fail("no_items");
  if (order.status !== "invoiced" && order.status !== "delivered") {
    return fail("not_invoiced");
  }

  const existing = order.challans ?? [];
  const version = existing.length + 1;
  const date = input.date ? new Date(input.date) : new Date();
  const dispatchNote = input.dispatchNote?.trim() || null;

  const challanNumber =
    order.challanNumber ??
    formatChallanNumber({
      code: order.leadSnapshot.code,
      date,
      seq: await nextChallanSeq(),
    });

  const tpl = await getCurrentTemplate("challan");
  const pdf = await renderFitted((fit) =>
    React.createElement(ChallanDocument, {
      fit,
      template: tpl.template,
      assets: tpl.assets,
      data: {
        challanNumber,
        date,
        invoiceNumber: order.invoiceNumber ?? null,
        referenceNo: order.referenceNo ?? null,
        deliverTo: {
          organisation: order.leadSnapshot.organisation,
          address: order.leadSnapshot.address,
          contactPerson: order.leadSnapshot.contactName ?? null,
          phone: order.leadSnapshot.phone ?? null,
          email: order.leadSnapshot.email ?? null,
        },
        // The one document that prints an equipment line's serial number:
        // it is what the hospital's gate checks the machine against.
        lines: toLines(order, "ordered", { serial: true }),
        dispatchNote,
      },
    }),
  );

  const filename = `Challan ${challanNumber.replaceAll("/", "-")}.pdf`;
  const documentId = await fileInVault(order, "challan", filename, pdf, actor);

  const challans = existing.map((v) =>
    v.supersededAt ? v : { ...v, supersededAt: new Date() },
  );
  challans.push({
    version,
    generatedAt: new Date(),
    generatedBy: actor.sub,
    snapshot: {
      items: order.items.map(stripReservation),
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      deliveryMinor: order.deliveryMinor ?? 0,
      vatRateBp: order.vatRateBp,
      vatAmountMinor: order.vatAmountMinor ?? null,
      vatMinor: order.vatMinor,
      totalMinor: order.totalMinor,
      referenceNo: order.referenceNo ?? null,
      terms: order.terms,
      invoiceNumber: order.invoiceNumber ?? null,
      challanNumber,
      dispatchNote,
      deliveryDate: date,
      quantityMode: "ordered",
    },
    documentId,
    emailedTo: [],
    templateRef: { kind: tpl.kind, version: tpl.version },
  });

  await updateSalesOrder(orderId, { challans, challanNumber });
  await addSalesOrderActivity(orderId, {
    authorId: actor.sub,
    body: `Delivery challan ${challanNumber} generated (v${version})`,
  });

  return done({ version, challanNumber, documentId });
}

// ─────────────────────────── serve + send ───────────────────────────

/** Which array on the order holds a given kind of document. */
const listKey = (kind: DocKind) =>
  kind === "proposal"
    ? ("proposals" as const)
    : kind === "invoice"
      ? ("invoices" as const)
      : ("challans" as const);

const KIND_LABEL: Record<DocKind, string> = {
  proposal: "Proposal",
  invoice: "Invoice",
  challan: "Delivery challan",
};

/** Re-render a stored version, so an old document reproduces exactly. */
export async function renderVersion(
  orderId: string,
  kind: DocKind,
  version: number,
): Promise<DocResult<{ pdf: Buffer; filename: string }>> {
  const order = await getSalesOrderById(orderId);
  if (!order) return fail("not_found");
  const list = order[listKey(kind)] ?? [];
  const entry = list.find((v) => v.version === version);
  if (!entry) return fail("not_found");

  const snap = entry.snapshot;
  // Straight from the snapshot, including the VAT each line carried: this
  // reproduces a document a client already holds, so nothing here may be
  // recomputed from today's order.
  // A proposal quoted per piece printed a quantity of one on every line. The
  // snapshot keeps the order's real quantities, so the mode has to be applied
  // again here or the reproduction is not the document that was sent.
  const perPiece = snap.quantityMode === "single";
  // Which layout drew it: the pinned template's kind is the record. A row
  // without one predates both templates and equipment orders, and is
  // consumables; the order's own kind is only the fallback. The challan is
  // one template for both kinds, so there the order's kind is the record —
  // it cannot change once the order is invoiced, and a challan needs that.
  const equipment =
    kind === "challan"
      ? orderKindOf(order) === "equipment"
      : entry.templateRef?.kind
        ? entry.templateRef.kind.startsWith("equipment")
        : orderKindOf(order) === "equipment";
  const layoutKind: TemplateKind =
    kind === "proposal"
      ? equipment
        ? "equipmentProposal"
        : "proposal"
      : kind === "invoice"
        ? equipment
          ? "equipmentInvoice"
          : "invoice"
        : "challan";
  const lines: DocumentLine[] = snap.items.map((i) => {
    const qty = perPiece ? 1 : i.qty;
    const lineTotalMinor = perPiece ? i.unitPriceMinor : i.lineTotalMinor;
    const rateBp = effectiveVatRateBp(i);
    return {
      ...printedColumns({ kind: equipment ? "equipment" : "consumables" }, i, {
        serial: kind === "challan",
      }),
      unit: i.unit ?? null,
      unitPriceMinor: i.unitPriceMinor,
      qty,
      lineTotalMinor,
      vatRateBp: rateBp,
      vatMinor: perPiece
        ? Math.round((lineTotalMinor * rateBp) / 10000)
        : (i.vatMinor ?? 0),
    };
  });
  const who = await signatory();
  // The template it was drawn with, never today's: the layout is part of what
  // the client received.
  const tpl = await getTemplateForRender(
    layoutKind,
    entry.templateRef?.version,
  );

  if (kind === "proposal") {
    const to = {
      organisation: order.leadSnapshot.organisation,
      address: order.leadSnapshot.address,
      department: snap.addressee?.dept ?? null,
      attention:
        snap.addressee?.title ?? order.leadSnapshot.contactName ?? null,
      phone: order.leadSnapshot.phone ?? null,
      email: order.leadSnapshot.email ?? null,
    };
    const pdf = await renderFitted((fit) =>
      equipment
        ? React.createElement(EquipmentProposalDocument, {
            fit,
            template: tpl.template,
            assets: tpl.assets,
            data: {
              proposalNo: order.number,
              date: new Date(entry.generatedAt),
              to,
              subject: snap.subject ?? "Quotation",
              intro: snap.intro ?? null,
              equipment: toEquipment(snap.items),
              accessories: toAccessories(snap.items),
              subtotalMinor: snap.subtotalMinor,
              discountMinor: snap.discountMinor,
              vatRateBp: snap.vatRateBp,
              vatAmountMinor: snap.vatAmountMinor ?? null,
              vatMinor: snap.vatMinor,
              deliveryMinor: snap.deliveryMinor ?? 0,
              totalMinor: snap.totalMinor,
              aitRateBp: snap.aitRateBp ?? 0,
              perLineVat: hasPerLineVat(snap.items),
              terms: {
                ...completeEquipmentTerms(snap.equipmentTerms),
                validityDays: snap.terms.validityDays,
              },
              signatory: who,
            },
          })
        : React.createElement(ProposalDocument, {
            fit,
            template: tpl.template,
            assets: tpl.assets,
            data: {
              proposalNo: order.number,
              date: new Date(entry.generatedAt),
              to,
              subject: snap.subject ?? "Proposal",
              intro: snap.intro ?? "",
              lines,
              terms: snap.terms,
              signatory: who,
            },
          }),
    );
    return done({
      pdf,
      filename: `Proposal ${order.number} v${version}.pdf`,
    });
  }

  if (kind === "challan") {
    const pdf = await renderFitted((fit) =>
      React.createElement(ChallanDocument, {
        fit,
        template: tpl.template,
        assets: tpl.assets,
        data: {
          challanNumber: snap.challanNumber ?? order.number,
          date: new Date(snap.deliveryDate ?? entry.generatedAt),
          invoiceNumber: snap.invoiceNumber ?? null,
          referenceNo: snap.referenceNo ?? null,
          deliverTo: {
            organisation: order.leadSnapshot.organisation,
            address: order.leadSnapshot.address,
            contactPerson: order.leadSnapshot.contactName ?? null,
            phone: order.leadSnapshot.phone ?? null,
            email: order.leadSnapshot.email ?? null,
          },
          lines,
          dispatchNote: snap.dispatchNote ?? null,
        },
      }),
    );
    return done({
      pdf,
      filename: `Challan ${(snap.challanNumber ?? order.number).replaceAll("/", "-")}.pdf`,
    });
  }

  const invoiceData = {
    invoiceNumber: snap.invoiceNumber ?? order.number,
    invoiceDate: new Date(snap.invoiceDate ?? entry.generatedAt),
    paymentDue: addDays(
      new Date(snap.invoiceDate ?? entry.generatedAt),
      snap.terms.paymentDays,
    ),
    customerId: snap.customerId ?? null,
    referenceNo: snap.referenceNo ?? null,
    deliveryDate: snap.deliveryDate ? new Date(snap.deliveryDate) : null,
    billTo: {
      organisation: order.leadSnapshot.organisation,
      address: order.leadSnapshot.address,
      contactPerson: order.leadSnapshot.contactName ?? null,
      phone: order.leadSnapshot.phone ?? null,
      email: order.leadSnapshot.email ?? null,
    },
    subtotalMinor: snap.subtotalMinor,
    discountMinor: snap.discountMinor,
    vatRateBp: snap.vatRateBp,
    vatAmountMinor: snap.vatAmountMinor ?? null,
    vatMinor: snap.vatMinor,
    aitRateBp: snap.aitRateBp ?? 0,
    deliveryMinor: snap.deliveryMinor ?? 0,
    totalMinor: snap.totalMinor,
    // Reprints show what was paid AT THE TIME, not what is paid now: the
    // document a client holds must stay reproducible.
    paidMinor: snap.paidMinor ?? 0,
    paymentDays: snap.terms.paymentDays,
    signatory: who,
  };
  const pdf = await renderFitted((fit) =>
    equipment
      ? React.createElement(EquipmentInvoiceDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: {
            ...invoiceData,
            equipment: toEquipment(snap.items),
            accessories: toAccessories(snap.items),
            perLineVat: hasPerLineVat(snap.items),
          },
        })
      : React.createElement(InvoiceDocument, {
          fit,
          template: tpl.template,
          assets: tpl.assets,
          data: { ...invoiceData, lines },
        }),
  );
  return done({
    pdf,
    filename: `Invoice ${(snap.invoiceNumber ?? order.number).replace(/\//g, "-")}.pdf`,
  });
}

/**
 * Email a document version to the client, with the PDF attached.
 *
 * The recipient defaults to the lead's stored address; sending anywhere else
 * needs an explicit confirmation, so a mistyped address cannot quietly send a
 * client's pricing to a stranger.
 */
export async function sendDocument(
  orderId: string,
  kind: DocKind,
  version: number,
  input: SendDocumentInput,
  actor: Actor,
): Promise<DocResult<{ to: string }>> {
  const order = await getSalesOrderById(orderId);
  if (!order) return fail("not_found");

  const stored = order.leadSnapshot.email?.toLowerCase() ?? null;
  const to = input.to.trim().toLowerCase();
  if (stored && to !== stored && !input.confirmRecipient) {
    return fail("recipient_mismatch");
  }

  const rendered = await renderVersion(orderId, kind, version);
  if (!rendered.ok) return rendered;

  const { teamInbox, mdEmail } = await salesEmails();
  const { html, text, attachments } = renderEmail({
    heading: input.subject,
    greetingName: order.leadSnapshot.contactName,
    paragraphs: input.body.split(/\n{2,}/).filter(Boolean),
    details: {
      rows: [
        { label: "Reference", value: order.number },
        ...(kind === "invoice" && order.invoiceNumber
          ? [{ label: "Invoice", value: order.invoiceNumber }]
          : []),
      ],
    },
  });

  await getMailer().send({
    to: input.to,
    // The sales inbox keeps a copy of everything that goes to a client.
    cc: teamInbox,
    // From is a fixed no-reply sender, so point replies at a person.
    replyTo: mdEmail,
    subject: input.subject,
    html,
    text,
    attachments: [
      ...(attachments ?? []),
      {
        filename: rendered.data.filename,
        content: rendered.data.pdf,
        contentType: "application/pdf",
      },
    ],
  });

  await markVersionEmailed(
    orderId,
    listKey(kind),
    version,
    input.to,
    actor.sub,
  );
  await addSalesOrderActivity(orderId, {
    authorId: actor.sub,
    body: `${KIND_LABEL[kind]} v${version} emailed to ${input.to}`,
  });

  return done({ to: input.to });
}
