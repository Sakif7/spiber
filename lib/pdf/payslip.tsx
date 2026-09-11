import React from "react";
import type { TemplateDoc } from "@/lib/schemas/pdf-template";
import type { StampAssets } from "./types";
import { DEFAULT_TEMPLATES } from "./engine/defaults";
import { buildPayslipContext } from "./engine/context";
import { TemplateDocument } from "./engine/render-template";
import type { PayslipData } from "./types";

export type { PayslipData } from "./types";

/** A director's payslip for one month — see `PayslipData`. */
export function PayslipDocument({
  data,
  template = DEFAULT_TEMPLATES.payslip,
  assets,
}: {
  data: PayslipData;
  template?: TemplateDoc;
  assets?: StampAssets;
}) {
  return (
    <TemplateDocument
      kind="payslip"
      template={template}
      assets={assets}
      ctx={buildPayslipContext(data)}
    />
  );
}
