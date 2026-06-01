import type { z } from "zod";

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; issues: z.core.$ZodIssue[] };

/**
 * Parse + validate a request JSON body against a Zod schema. Never throws on
 * bad input — returns a discriminated result the caller maps to a 400.
 */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  const raw = await req.json().catch(() => null);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, issues: result.error.issues };
  }
  return { success: true, data: result.data };
}
