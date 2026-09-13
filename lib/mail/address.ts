/**
 * Company mail addresses — pure helpers, safe to import from client code.
 *
 * The domain is fixed per deployment (`MAIL_DOMAIN`, default spibermed.com);
 * the UI only ever asks for the local part, so nobody can type an address on
 * another domain into the "business email" field.
 */

export const DEFAULT_MAIL_DOMAIN = "spibermed.com";

/** Lower-case, dot/dash/underscore/plus allowed, 1–64 chars, no leading dot. */
export const MAIL_LOCAL_PART = /^[a-z0-9](?:[a-z0-9._+-]{0,63})$/;

export function normaliseLocalPart(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidLocalPart(local: string): boolean {
  return MAIL_LOCAL_PART.test(local) && !local.endsWith(".");
}

export function businessAddress(local: string, domain: string): string {
  return `${normaliseLocalPart(local)}@${domain.toLowerCase()}`;
}

/**
 * A sensible default from a person's name: "Faria Tasnim" → "faria",
 * "Md. Jahidul Islam" → "jahidul" (honorifics dropped), falling back to the
 * whole name joined with dots when the first name is too short.
 */
export function suggestLocalPart(name: string): string {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s.-]/gu, "")
    .split(/[\s.]+/)
    .filter(Boolean)
    .filter((w) => !HONORIFICS.has(w));
  const ascii = (w: string) => w.replace(/[^a-z0-9]/g, "");
  const first = ascii(words[0] ?? "");
  if (first.length >= 3) return first;
  const joined = words.map(ascii).filter(Boolean).join(".");
  return joined.slice(0, 64);
}

const HONORIFICS = new Set(["md", "mr", "mrs", "ms", "dr", "prof", "eng"]);

/** 5 GB, the quota every personal mailbox starts with. */
export const DEFAULT_MAILBOX_QUOTA_BYTES = 5 * 1024 ** 3;

/** "5G" / "500M" — the form docker-mailserver's quota file takes. */
export function quotaLabel(bytes: number | null | undefined): string {
  if (!bytes) return "0";
  if (bytes % 1024 ** 3 === 0) return `${bytes / 1024 ** 3}G`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))}M`;
}

/**
 * "a@x, Name <b@y>; c@z" → addresses. Anything that is not a plausible
 * address is reported back rather than silently dropped.
 */
export function parseRecipients(
  raw: string,
):
  | { ok: true; list: { name: string | null; address: string }[] }
  | { ok: false; bad: string } {
  const list: { name: string | null; address: string }[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const s = part.trim();
    if (!s) continue;
    const m = s.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
    const address = (m ? m[2] : s).trim().toLowerCase();
    const name = m ? m[1]?.trim() || null : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      return { ok: false, bad: s };
    list.push({ name, address });
  }
  return { ok: true, list };
}
