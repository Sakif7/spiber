import React from "react";
import type { TemplateDoc } from "@/lib/schemas/pdf-template";
import type { StampAssets } from "./types";
import { DEFAULT_TEMPLATES } from "./engine/defaults";
import {
  buildChallanContext,
  buildInvoiceContext,
  buildProposalContext,
} from "./engine/context";
import { TemplateDocument } from "./engine/render-template";
import type { ChallanData, InvoiceData, ProposalData } from "./types";

export type {
  ChallanData,
  DocumentLine,
  InvoiceData,
  Party,
  ProposalData,
  Signatory,
} from "./types";
export { needsVatColumn, vatCell } from "./types";

/**
 * The three documents the sales flow produces.
 *
 * Each is the template engine applied to the document's data. The template
 * defaults to the built-in one — the layout as it was hand-coded — so a
 * caller that has no published template, and every document generated before
 * templates existed, renders exactly as before.
 */

export function ProposalDocument({
  data,
  template = DEFAULT_TEMPLATES.proposal,
  assets,
}: {
  data: ProposalData;
  template?: TemplateDoc;
  assets?: StampAssets;
}) {
  return (
    <TemplateDocument
      kind="proposal"
      template={template}
      assets={assets}
      ctx={buildProposalContext(data)}
    />
  );
}

export function InvoiceDocument({
  data,
  template = DEFAULT_TEMPLATES.invoice,
  assets,
}: {
  data: InvoiceData;
  template?: TemplateDoc;
  assets?: StampAssets;
}) {
  return (
    <TemplateDocument
      kind="invoice"
      template={template}
      assets={assets}
      ctx={buildInvoiceContext(data)}
    />
  );
}

export function ChallanDocument({
  data,
  template = DEFAULT_TEMPLATES.challan,
  assets,
}: {
  data: ChallanData;
  template?: TemplateDoc;
  assets?: StampAssets;
}) {
  return (
    <TemplateDocument
      kind="challan"
      template={template}
      assets={assets}
      ctx={buildChallanContext(data)}
    />
  );
}
