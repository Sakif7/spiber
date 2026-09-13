/**
 * Pane widths survive a reload through a cookie the page reads on the server
 * (so the first paint already has them — localStorage would hydrate wrong).
 */
export const MAIL_LAYOUT_COOKIE = "admin-mail-layout";
export type MailLayout = Record<string, number>;

/** Only what the group produces — three known panels, numeric sizes. */
export function parseMailLayout(
  raw: string | undefined,
): MailLayout | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!v || typeof v !== "object") return undefined;
    const entries = Object.entries(v as Record<string, unknown>);
    const ok =
      entries.length === 3 &&
      entries.every(
        ([k, n]) =>
          ["nav", "list", "display"].includes(k) &&
          typeof n === "number" &&
          Number.isFinite(n),
      );
    return ok ? (v as MailLayout) : undefined;
  } catch {
    return undefined;
  }
}
