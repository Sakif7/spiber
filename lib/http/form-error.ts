/**
 * Client-safe formatter for the API error envelope produced by `fail()`:
 *   { ok: false, error: { code, message?, details? } }
 *
 * Admin forms used to show only `error.code` (e.g. a bare "invalid_input"),
 * discarding the Zod `details` that say WHICH field failed. This turns those
 * details into a human-readable, field-pointing message so a blank required
 * field (e.g. an untitled course module) is obvious instead of cryptic.
 *
 * No server imports — safe to use in client components.
 */

type ZodIssueLike = { path?: (string | number)[]; message?: string };
type ApiErrorLike = { code?: string; message?: string; details?: unknown };

const KEY_LABELS: Record<string, string> = {
  title: "Title",
  name: "Name",
  summary: "Summary",
  description: "Description",
  body: "Body",
  prompt: "Prompt",
  text: "Option text",
  explanation: "Explanation",
  modules: "Module",
  lessons: "Lesson",
  questions: "Question",
  options: "Option",
  resources: "Resource",
  specs: "Spec",
  images: "Image",
  sku: "SKU",
  slug: "Slug",
  priceMinor: "Price",
  price: "Price",
  categoryId: "Category",
  brandId: "Brand",
  code: "Code",
  value: "Value",
  correctOptionId: "Correct option",
  passPercent: "Pass mark",
  email: "Email",
  password: "Password",
  thumbnail: "Thumbnail",
  fileKey: "File",
  deliveryType: "Delivery type",
  pricingModel: "Pricing model",
};

const CODE_MESSAGES: Record<string, string> = {
  invalid_input: "Some fields need attention.",
  save_failed: "Could not save. Please try again.",
  duplicate: "That already exists (duplicate slug/code).",
  forbidden: "You don't have permission to do that.",
  not_found: "Not found.",
  upload_failed: "Upload failed. Please try again.",
  too_large: "That file is too large.",
  bad_type: "That file type isn't allowed.",
};

function labelForPath(path: (string | number)[]): string {
  const segs: string[] = [];
  for (const p of path) {
    if (typeof p === "number") {
      if (segs.length) segs[segs.length - 1] += ` ${p + 1}`;
    } else if (p === "en" || p === "bn") {
      if (segs.length) segs[segs.length - 1] += p === "en" ? " (EN)" : " (BN)";
      else segs.push(p === "en" ? "English" : "Bangla");
    } else {
      segs.push(KEY_LABELS[p] ?? p);
    }
  }
  return segs.join(" → ") || "Field";
}

function friendlyCode(code: string): string {
  return CODE_MESSAGES[code] ?? code;
}

/**
 * Build a user-facing error string from a fetch()'d JSON body.
 * Prefers an explicit server message, then field-level Zod details, then code.
 */
export function formatApiError(
  json: unknown,
  fallback = "save_failed",
): string {
  const error = (json as { error?: ApiErrorLike } | null | undefined)?.error;
  if (!error) return friendlyCode(fallback);
  if (error.message) return error.message;

  if (Array.isArray(error.details) && error.details.length > 0) {
    const issues = error.details as ZodIssueLike[];
    const parts = issues.slice(0, 4).map((i) => {
      const label = labelForPath(i.path ?? []);
      return `${label}: ${i.message ?? "invalid"}`;
    });
    const more = issues.length > 4 ? ` (+${issues.length - 4} more)` : "";
    return `Please fix — ${parts.join("; ")}${more}`;
  }

  return friendlyCode(error.code ?? fallback);
}
