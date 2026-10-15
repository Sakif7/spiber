import React from "react";
import type { TemplateDoc } from "@/lib/schemas/pdf-template";
import type { StampAssets } from "./types";
import { DEFAULT_TEMPLATES } from "./engine/defaults";
import {
  buildChallanContext,
  buildEquipmentInvoiceContext,
  buildEquipmentProposalContext,
  buildInvoiceContext,
  buildProposalContext,
} from "./engine/context";
import { TemplateDocument } from "./engine/render-template";
import type { PageFit } from "./engine/fit";
import type {
  ChallanData,
  EquipmentInvoiceData,
  EquipmentProposalData,
  InvoiceData,
  ProposalData,
} from "./types";

export type {
  ChallanData,
  DocumentLine,
  EquipmentAccessory,
  EquipmentInvoiceData,
  EquipmentLine,
  EquipmentProposalData,
  InvoiceData,
  Party,
  ProposalData,
  Signatory,
} from "./types";
export { needsVatColumn, vatCell } from "./types";

/**
 * The documents the sales flow produces.
 *
 * Each is the template engine applied to the document's data. The template
 * defaults to the built-in one — the layout as it was hand-coded — so a
 * caller that has no published template, and every document generated before
 * templates existed, renders exactly as before. An equipment order has its
 * own proposal and invoice (a letter and a one-line bill) and shares the
 * challan.
 */

export function ProposalDocument({
  data,
  template = DEFAULT_TEMPLATES.proposal,
  assets,
  fit,
}: {
  data: ProposalData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="proposal"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildProposalContext(data)}
    />
  );
}

export function InvoiceDocument({
  data,
  template = DEFAULT_TEMPLATES.invoice,
  assets,
  fit,
}: {
  data: InvoiceData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="invoice"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildInvoiceContext(data)}
    />
  );
}

export function EquipmentProposalDocument({
  data,
  template = DEFAULT_TEMPLATES.equipmentProposal,
  assets,
  fit,
}: {
  data: EquipmentProposalData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="equipmentProposal"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildEquipmentProposalContext(data)}
    />
  );
}

export function EquipmentInvoiceDocument({
  data,
  template = DEFAULT_TEMPLATES.equipmentInvoice,
  assets,
  fit,
}: {
  data: EquipmentInvoiceData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="equipmentInvoice"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildEquipmentInvoiceContext(data)}
    />
  );
}

export function ChallanDocument({
  data,
  template = DEFAULT_TEMPLATES.challan,
  assets,
  fit,
}: {
  data: ChallanData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="challan"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildChallanContext(data)}
    />
  );
}
