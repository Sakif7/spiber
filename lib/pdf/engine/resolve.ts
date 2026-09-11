import type { TemplateKind } from "@/lib/schemas/pdf-template";
import { fmtDate, fmtLongDate, formatTaka } from "../format";
import { PLACEHOLDER, pathKind, type PathKind } from "./paths";
import type { RenderContext } from "./context";

/**
 * Placeholder resolution.
 *
 * A template never throws: an unknown path prints as nothing, so a half-edited
 * draft still previews and a published template can never take a document
 * down. Output is plain text into react-pdf's `<Text>`, which interprets no
 * markup, so there is nothing to escape.
 */

export function resolvePath(ctx: RenderContext, path: string): unknown {
  let cur: unknown = ctx;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    if (!Object.hasOwn(cur, seg)) return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur ?? null;
}

/** "Truthy" as a document reads it: something is there and it isn't zero. */
export function isPresent(v: unknown): boolean {
  if (v == null || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  return true;
}

export function isShown(ctx: RenderContext, showIf?: string): boolean {
  if (!showIf) return true;
  const negate = showIf.startsWith("!");
  const present = isPresent(
    resolvePath(ctx, negate ? showIf.slice(1) : showIf),
  );
  return negate ? !present : present;
}

function inferKind(path: string, v: unknown): PathKind {
  if (v instanceof Date) return "date";
  if (typeof v === "number") return path.endsWith("Minor") ? "money" : "number";
  if (typeof v === "boolean") return "bool";
  return "text";
}

export function formatValue(v: unknown, kind: PathKind): string {
  if (v == null) return "";
  switch (kind) {
    case "money":
      return typeof v === "number" ? formatTaka(v) : String(v);
    case "date":
      return v instanceof Date ? fmtDate(v) : String(v);
    case "longDate":
      return v instanceof Date ? fmtLongDate(v) : String(v);
    case "number":
      return typeof v === "number" ? String(v) : String(v);
    case "bool":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

/** Resolve and format one path the way its declared kind prints. */
export function formatPath(
  ctx: RenderContext,
  kind: TemplateKind,
  path: string,
): string {
  const v = resolvePath(ctx, path);
  return formatValue(v, pathKind(kind, path) ?? inferKind(path, v));
}

export function interpolate(
  text: string,
  ctx: RenderContext,
  kind: TemplateKind,
): string {
  return text.replace(PLACEHOLDER, (_m, path: string) =>
    formatPath(ctx, kind, path),
  );
}

/**
 * Does the text have placeholders, and do they ALL resolve to nothing?
 *
 * That is what `hideWhenEmpty` means for a line like "Approved: {{approvedAt}}":
 * the label is always there, the value is what decides.
 */
export function allPlaceholdersEmpty(
  text: string,
  ctx: RenderContext,
): boolean {
  const paths = [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
  if (paths.length === 0) return false;
  return paths.every((p) => !isPresent(resolvePath(ctx, p)));
}
