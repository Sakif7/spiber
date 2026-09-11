import {
  templateKindSchema,
  type TemplateKind,
} from "@/lib/schemas/pdf-template";
import { fail } from "@/lib/http/respond";
import type { TemplateError } from "@/lib/services/pdf-template.service";

/** Parse the `[kind]` segment, or the 404 to return. */
export function parseKind(
  raw: string,
): { ok: true; kind: TemplateKind } | { ok: false; res: Response } {
  const parsed = templateKindSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, kind: parsed.data }
    : { ok: false, res: fail({ code: "not_found" }, 404) };
}

export function templateStatus(code: TemplateError): number {
  switch (code) {
    case "not_found":
      return 404;
    case "no_draft":
    case "draft_gone":
      return 409;
    default:
      return 400;
  }
}
