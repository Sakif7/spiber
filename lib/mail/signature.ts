import { LEGAL, OFFICES } from "@/lib/contact";

/**
 * Email signatures: what sits under a message sent from a company mailbox.
 *
 * Each employee has at most one, set on their page by a super admin: rich
 * text from the composer's own allowlist, and whether the company logo goes
 * above it. A personal mailbox signs with its owner's; a shared one (info@,
 * sales@, …) offers everyone's to pick from.
 *
 * In the composer the signature is a block of its own (`data-mail-signature`)
 * between what is typed and the quoted original, so switching it swaps that
 * block and nothing else. The logo travels as an inline image: the editor
 * shows it from `SIGNATURE_LOGO_SRC`, and the send path swaps that for a
 * `cid:` part carrying the same file — never a remote image the recipient's
 * mail app would block.
 *
 * Free of any database import: the composer and the employee page share it.
 */

/** The logo file (public/email/logo.png, 300×105 — `npm run make-pdf-assets`). */
export const SIGNATURE_LOGO_SRC = "/email/logo.png";
export const SIGNATURE_LOGO_FILE = ["email", "logo.png"] as const;
/** Drawn at half its pixel size or a little more, so it is sharp on a phone. */
export const SIGNATURE_LOGO_WIDTH = 160;
export const SIGNATURE_LOGO_HEIGHT = 56;
export const SIGNATURE_LOGO_ALT = "Spiber Med";

/** Longest signature HTML accepted — a signature, not a newsletter. */
export const MAX_SIGNATURE_HTML = 5000;

export type EmailSignature = { html: string; logo: boolean };

/** One signature the composer can put under a message. */
export type SignatureOption = {
  /** The employee it belongs to. */
  id: string;
  name: string;
  designation: string | null;
  /** The block's content, logo included — ready to drop into the editor. */
  html: string;
};

/** What the composer offers for one mailbox. */
export type SignatureChoices = {
  /** A shared mailbox offers everyone's; a personal one only its owner's. */
  shared: boolean;
  options: SignatureOption[];
  /** The one to start with: the owner's, or the writer's own on a shared one. */
  defaultId: string | null;
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The logo as the editor draws it; the send path turns it into a cid part. */
export function signatureLogoHtml(): string {
  return `<p><img data-mail-logo="" src="${SIGNATURE_LOGO_SRC}" alt="${SIGNATURE_LOGO_ALT}" width="${SIGNATURE_LOGO_WIDTH}" height="${SIGNATURE_LOGO_HEIGHT}"></p>`;
}

/** The content of a signature block: the logo when asked for, then the text. */
export function signatureBlockHtml(sig: EmailSignature): string {
  return `${sig.logo ? signatureLogoHtml() : ""}${sig.html}`;
}

/** "SPIBER MED LIMITED" → "Spiber Med Limited", as it reads under a name. */
function companyName(): string {
  return LEGAL.name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * A starting point built from the employee record: name, designation, the
 * company, how to reach them, the head office. Edited freely afterwards.
 */
export function defaultEmailSignatureHtml(person: {
  name: string;
  designation?: string | null;
  phone?: string | null;
  businessEmail?: string | null;
}): string {
  const who = [
    `<strong>${esc(person.name)}</strong>`,
    person.designation ? esc(person.designation) : null,
    esc(companyName()),
  ].filter(Boolean);
  const reach = [
    person.phone ? `Mobile: ${esc(person.phone)}` : null,
    person.businessEmail
      ? `Email: <a href="mailto:${esc(person.businessEmail)}">${esc(person.businessEmail)}</a>`
      : null,
    `Web: <a href="https://www.spibermed.com">www.spibermed.com</a>`,
  ].filter(Boolean);
  const office = OFFICES[0]?.address.en.replace(/\s*\n\s*/g, " ") ?? "";
  return [
    `<p>${who.join("<br>")}</p>`,
    `<p>${reach.join("<br>")}</p>`,
    office ? `<p>${esc(office)}</p>` : "",
  ].join("");
}
