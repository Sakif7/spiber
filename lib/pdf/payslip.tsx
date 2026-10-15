import React from "react";
import type { TemplateDoc } from "@/lib/schemas/pdf-template";
import type { StampAssets } from "./types";
import { DEFAULT_TEMPLATES } from "./engine/defaults";
import { buildPayslipContext } from "./engine/context";
import { TemplateDocument } from "./engine/render-template";
import type { PageFit } from "./engine/fit";
import type { PayslipData } from "./types";

export type { PayslipData } from "./types";

/** A director's payslip for one month — see `PayslipData`. */
export function PayslipDocument({
  data,
  template = DEFAULT_TEMPLATES.payslip,
  assets,
  fit,
}: {
  data: PayslipData;
  template?: TemplateDoc;
  assets?: StampAssets;
  /** Chosen by `renderFitted`; absent, the template prints as designed. */
  fit?: PageFit;
}) {
  return (
    <TemplateDocument
      kind="payslip"
      template={template}
      assets={assets}
      fit={fit}
      ctx={buildPayslipContext(data)}
    />
  );
}
