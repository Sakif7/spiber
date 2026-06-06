import { readFileSync } from "node:fs";
import path from "node:path";
import { siteConfig } from "@/lib/site-config";
import type { MailAttachment } from "@/lib/mailer/types";

const LOGO_CID = "spibermed-logo";
let logoCache: Buffer | null | undefined;

/** Read the logo once (cached). null if unavailable (then we fall back to a URL). */
function loadLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = readFileSync(
      path.join(process.cwd(), "public", "spibermed-logo.png"),
    );
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/**
 * Spiber Med branded transactional email layout.
 *
 * Email HTML is its own dialect: no flexbox/grid, no external stylesheet (many
 * clients strip <style>), limited CSS — so everything here is table-based with
 * INLINE styles and a ~600px centred card. Each email is composed from a small
 * content model and rendered to BOTH `html` and a clean `text` fallback.
 */

export type EmailAccent = "teal" | "orange";

export type EmailDetailRow = { label: string; value: string; strong?: boolean };

export type EmailContent = {
  /** Inbox preview snippet (hidden in the body). */
  preheader?: string;
  /** Small uppercase label above the heading. */
  eyebrow?: string;
  heading: string;
  /** "Hi {greetingName}," — omitted if absent. */
  greetingName?: string;
  /** Intro body paragraphs (plain text; rendered as <p>). */
  paragraphs: string[];
  /** Tinted detail panel (e.g. order number / total / reference). */
  details?: { title?: string; rows: EmailDetailRow[] };
  /** Call-to-action button. */
  button?: { label: string; url: string };
  /** Closing paragraphs after the button. */
  outro?: string[];
  /** Accent colour — teal (default) for most, orange for Academy. */
  accent?: EmailAccent;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ACCENTS: Record<
  EmailAccent,
  { main: string; deep: string; soft: string }
> = {
  teal: { main: "#0d8f91", deep: "#097377", soft: "#eefbfb" },
  orange: { main: "#e66b26", deep: "#c2531a", soft: "#fdf1e9" },
};

const COLOR = {
  pageBg: "#eef1f2",
  card: "#ffffff",
  border: "#e3e9ea",
  heading: "#02080b",
  body: "#3f4d57",
  muted: "#8a99a2",
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailPanel(
  details: NonNullable<EmailContent["details"]>,
  soft: string,
): string {
  const rows = details.rows
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0;font-family:${FONT};font-size:14px;color:${COLOR.muted};">${escapeHtml(r.label)}</td>
          <td align="right" style="padding:6px 0;font-family:${FONT};font-size:14px;color:${COLOR.heading};font-weight:${r.strong ? 700 : 500};">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join("");
  const title = details.title
    ? `<div style="font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${COLOR.muted};padding-bottom:8px;">${escapeHtml(details.title)}</div>`
    : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${soft};border-radius:12px;margin:6px 0 22px;">
      <tr><td style="padding:18px 22px;">
        ${title}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </td></tr>
    </table>`;
}

function button(b: { label: string; url: string }, main: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
      <tr><td align="center" bgcolor="${main}" style="border-radius:9px;">
        <a href="${escapeHtml(b.url)}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:9px;">${escapeHtml(b.label)} &rarr;</a>
      </td></tr>
    </table>`;
}

/** Render a branded email to inline-styled HTML + a plain-text fallback. */
export function renderEmail(content: EmailContent): {
  html: string;
  text: string;
  attachments: MailAttachment[];
} {
  const accent = ACCENTS[content.accent ?? "teal"];
  // Embed the logo inline (CID) so it shows even when a client blocks remote
  // images or APP_URL isn't publicly reachable (e.g. localhost in dev). Falls
  // back to the hosted URL if the file can't be read.
  const logoBuf = loadLogo();
  const logo = logoBuf
    ? `cid:${LOGO_CID}`
    : `${siteConfig.url}/spibermed-logo.png`;
  const attachments: MailAttachment[] = logoBuf
    ? [
        {
          filename: "spibermed-logo.png",
          content: logoBuf,
          cid: LOGO_CID,
          contentType: "image/png",
        },
      ]
    : [];
  const year = new Date().getFullYear();

  const paras = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${COLOR.body};">${escapeHtml(p)}</p>`,
    )
    .join("");
  const outro = (content.outro ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${COLOR.body};">${escapeHtml(p)}</p>`,
    )
    .join("");
  const greeting = content.greetingName
    ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${COLOR.body};">Hi ${escapeHtml(content.greetingName)},</p>`
    : "";
  const eyebrow = content.eyebrow
    ? `<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${accent.deep};margin-bottom:10px;">${escapeHtml(content.eyebrow)}</div>`
    : "";
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(content.preheader)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.pageBg};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.pageBg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:16px;overflow:hidden;">
        <!-- brand accent bar -->
        <tr>
          <td height="5" style="height:5px;line-height:5px;font-size:0;background:${ACCENTS.teal.main};width:62%;">&nbsp;</td>
          <td height="5" style="height:5px;line-height:5px;font-size:0;background:${ACCENTS.orange.main};width:38%;">&nbsp;</td>
        </tr>
        <!-- header / logo -->
        <tr><td colspan="2" align="center" style="padding:28px 32px 8px;">
          <img src="${logo}" width="172" alt="${escapeHtml(siteConfig.brand)}" style="display:block;width:172px;max-width:60%;height:auto;border:0;" />
        </td></tr>
        <!-- body -->
        <tr><td colspan="2" style="padding:20px 36px 8px;">
          ${eyebrow}
          <h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;line-height:1.3;font-weight:700;color:${COLOR.heading};">${escapeHtml(content.heading)}</h1>
          ${greeting}
          ${paras}
          ${content.details ? detailPanel(content.details, accent.soft) : ""}
          ${content.button ? button(content.button, accent.main) : ""}
          ${outro}
        </td></tr>
        <!-- footer -->
        <tr><td colspan="2" style="padding:24px 36px 30px;border-top:1px solid ${COLOR.pageBg};">
          <p style="margin:0 0 4px;font-family:${FONT};font-size:13px;color:${COLOR.heading};font-weight:600;">${escapeHtml(siteConfig.brand)} <span style="color:${COLOR.muted};font-weight:400;">Ltd.</span></p>
          <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">Medical devices &middot; Academy &middot; Health software &middot; Tourism &middot; Consulting</p>
          <p style="margin:0;font-family:${FONT};font-size:12px;color:${COLOR.muted};">
            <a href="${siteConfig.url}" target="_blank" style="color:${accent.deep};text-decoration:none;">${escapeHtml(siteConfig.domain)}</a>
            &nbsp;&middot;&nbsp; &copy; ${year} ${escapeHtml(siteConfig.brand)}
          </p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-family:${FONT};font-size:11px;color:${COLOR.muted};">This is an automated message — please don't reply directly.</p>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain-text fallback (clients without HTML / accessibility).
  const lines: string[] = [];
  if (content.eyebrow) lines.push(content.eyebrow.toUpperCase());
  lines.push(content.heading, "");
  if (content.greetingName) lines.push(`Hi ${content.greetingName},`, "");
  for (const p of content.paragraphs) lines.push(p, "");
  if (content.details) {
    if (content.details.title) lines.push(content.details.title);
    for (const r of content.details.rows)
      lines.push(`  ${r.label}: ${r.value}`);
    lines.push("");
  }
  if (content.button)
    lines.push(`${content.button.label}: ${content.button.url}`, "");
  for (const p of content.outro ?? []) lines.push(p, "");
  lines.push("—", `${siteConfig.brand} Ltd. · ${siteConfig.url}`);
  const text = lines.join("\n");

  return { html, text, attachments };
}
