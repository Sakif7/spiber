import { z } from "zod";

/** Metadata edits on a vault document (the binary itself is immutable). */
export const companyDocumentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  folder: z.string().trim().max(80).nullable().optional(),
});
export type CompanyDocumentUpdateInput = z.infer<
  typeof companyDocumentUpdateSchema
>;
