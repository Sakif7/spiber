import React from "react";
import { logger } from "@/lib/log";
import { CONTACT } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import { renderPdf } from "@/lib/pdf/render";
import { addDays } from "@/lib/pdf/format";
import {
  ProposalDocument,
  InvoiceDocument,
  ChallanDocument,
  type DocumentLine,
  type Signatory,
} from "@/lib/pdf/documents";
import type { ISalesOrder, IDocumentVersion } from "@/lib/models/salesOrder";
import type { Lean } from "@/lib/models/_shared";
import { getSetting } from "@/lib/repositories/settings.repo";
import { getMailer } from "@/lib/mailer";
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
import { effectiveVatRateBp } from "@/lib/schemas/sales-order";
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

async function salesEmails(): Promise<{ teamInbox: string; mdEmail: string }> {
  const stored = await getSetting<{ teamInbox?: string; mdEmail?: string }>(
    "sales.email",
  ).catch(() => null);
  return {
    teamInbox:
      stored?.teamInbox ??
      process.env.SALES_TEAM_EMAIL ??
      process.env.CONTACT_TEAM_EMAIL ??
      CONTACT.generalEmail,
    mdEmail: stored?.mdEmail ?? "md@spibermed.com",
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
const toLines = (
  order: Lean<ISalesOrder>,
  quantityMode: "single" | "ordered" = "ordered",
): DocumentLine[] =>
  order.items.map((i) => {
    const qty = quantityMode === "single" ? 1 : i.qty;
    const lineTotalMinor = i.unitPriceMinor * qty;
    const rateBp = effectiveVatRateBp(i);
    return {
      description: i.description,
      brandOrigin: i.brandOrigin ?? null,
      specification: i.specification ?? null,
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
  const quantityMode = input.quantityMode ?? "ordered";
  const date = new Date();
  const terms = { ...order.terms, ...(input.terms ?? {}) };
  const subject =
    input.subject?.trim() || "Proposal for Medical and Surgical Consumables";
  const intro =
    input.intro?.trim() ||
    "Thank you for giving us the opportunity to quote our Medical Disposable product within your esteemed organization; we are very much pleased to offer our Surgical Items as follows;";
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

  const pdf = await renderPdf(
    React.createElement(ProposalDocument, {
      data: {
        proposalNo: order.number,
        date,
        to: proposalTo,
        subject,
        intro,
        lines: toLines(order, quantityMode),
        terms,
        signatory: await signatory(),
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
      vatRateBp: order.vatRateBp,
      vatMinor: order.vatMinor,
      aitRateBp: order.aitRateBp ?? 0,
      totalMinor: order.totalMinor,
      terms,
      addressee,
      subject,
      intro,
      quantityMode,
    },
    documentId,
    emailedTo: [],
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

  const pdf = await renderPdf(
    React.createElement(InvoiceDocument, {
      data: {
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
        lines: toLines(order),
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        vatRateBp: order.vatRateBp,
        vatMinor: order.vatMinor,
        deliveryMinor: order.deliveryMinor ?? 0,
        totalMinor: order.totalMinor,
        aitRateBp: order.aitRateBp ?? 0,
        // Only whole-order payment is tracked, so this is all or nothing.
        paidMinor: order.payment.status === "paid" ? order.totalMinor : 0,
        paymentDays,
        signatory: await signatory(),
      },
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
  });

  await updateSalesOrder(orderId, {
    invoices,
    invoiceNumber,
    invoicedAt: order.invoicedAt ?? invoiceDate,
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

  const pdf = await renderPdf(
    React.createElement(ChallanDocument, {
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
        lines: toLines(order),
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
  const lines: DocumentLine[] = snap.items.map((i) => {
    const qty = perPiece ? 1 : i.qty;
    const lineTotalMinor = perPiece ? i.unitPriceMinor : i.lineTotalMinor;
    const rateBp = effectiveVatRateBp(i);
    return {
      description: i.description,
      brandOrigin: i.brandOrigin ?? null,
      specification: i.specification ?? null,
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

  if (kind === "proposal") {
    const pdf = await renderPdf(
      React.createElement(ProposalDocument, {
        data: {
          proposalNo: order.number,
          date: new Date(entry.generatedAt),
          to: {
            organisation: order.leadSnapshot.organisation,
            address: order.leadSnapshot.address,
            department: snap.addressee?.dept ?? null,
            attention:
              snap.addressee?.title ?? order.leadSnapshot.contactName ?? null,
            phone: order.leadSnapshot.phone ?? null,
            email: order.leadSnapshot.email ?? null,
          },
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
    const pdf = await renderPdf(
      React.createElement(ChallanDocument, {
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

  const pdf = await renderPdf(
    React.createElement(InvoiceDocument, {
      data: {
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
        lines,
        subtotalMinor: snap.subtotalMinor,
        discountMinor: snap.discountMinor,
        vatRateBp: snap.vatRateBp,
        vatMinor: snap.vatMinor,
        aitRateBp: snap.aitRateBp ?? 0,
        deliveryMinor: snap.deliveryMinor ?? 0,
        totalMinor: snap.totalMinor,
        // Reprints show what was paid AT THE TIME, not what is paid now: the
        // document a client holds must stay reproducible.
        paidMinor: snap.paidMinor ?? 0,
        paymentDays: snap.terms.paymentDays,
        signatory: who,
      },
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
