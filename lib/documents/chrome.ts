import { PAGE, contentHeight, fontById, type DocumentFont } from "./types";
import type { DocumentSettings } from "@/lib/schemas/authored-document";

/**
 * The page "chrome" — letterhead, running header, footer line, page number,
 * footer band — as HTML strings and CSS, built the same way for the editor
 * (React injects them) and for the printer (Chromium renders them). No DOM,
 * no filesystem: the caller supplies the logo URL.
 *
 * The letterhead reproduces the invoice stationery: teal bar down the left
 * edge, the wordmark, a contact column with round icon badges, the two-tone
 * rule beneath, the band across the foot.
 */
export type ChromeCompany = {
  name: string;
  phone: string;
  email: string;
  website: string;
  headOfficeAddress: string;
  regionalOfficeAddress: string;
};

export type ChromeInput = {
  settings: DocumentSettings;
  company: ChromeCompany;
  number: string | null;
  title: string;
  logoSrc: string | null;
  accent?: string;
};

const ACCENT = "#20b0b0";
const ICONS: Record<string, string> = {
  phone:
    '<path d="M7 3 L11 3 L12.5 8 L10 9.5 C11 12 12 13 14.5 14 L16 11.5 L21 13 L21 17 C21 19 19.5 20.5 17.5 20.3 C10 19.5 4.5 14 3.7 6.5 C3.5 4.5 5 3 7 3 Z"/>',
  mail: '<path d="M3 6 L21 6 L21 18 L3 18 Z"/><path d="M3 6 L12 13 L21 6"/>',
  web: '<path d="M12 3 C16.9 3 21 7.1 21 12 C21 16.9 16.9 21 12 21 C7.1 21 3 16.9 3 12 C3 7.1 7.1 3 12 3 Z"/><path d="M3 12 L21 12"/><path d="M12 3 C15 6.5 15 17.5 12 21 C9 17.5 9 6.5 12 3 Z"/>',
  place:
    '<path d="M12 2.5 C16 2.5 19 5.5 19 9.5 C19 14.5 12 21.5 12 21.5 C12 21.5 5 14.5 5 9.5 C5 5.5 8 2.5 12 2.5 Z"/><path d="M12 7 C13.4 7 14.5 8.1 14.5 9.5 C14.5 10.9 13.4 12 12 12 C10.6 12 9.5 10.9 9.5 9.5 C9.5 8.1 10.6 7 12 7 Z"/>',
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function icon(kind: string, accent: string): string {
  return `<span class="doc-lh-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.5" fill="${accent}"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" transform="translate(4.8 4.8) scale(0.6)">${ICONS[kind] ?? ""}</g></svg></span>`;
}

/** The letterhead block (logo + contact column + rule), once per page. */
export function letterheadHtml(c: ChromeInput): string {
  const accent = c.accent ?? ACCENT;
  const co = c.company;
  const lines = [
    { icon: "phone", text: co.phone },
    { icon: "mail", text: co.email },
    { icon: "web", text: co.website },
    { icon: "place", label: "Head Office:", text: co.headOfficeAddress },
    {
      icon: "place",
      label: "Regional Office:",
      text: co.regionalOfficeAddress,
    },
  ].filter((l) => l.text);
  const logo = c.logoSrc
    ? `<img class="doc-lh-logo" src="${c.logoSrc}" alt="${esc(co.name)}">`
    : `<span class="doc-lh-wordmark">${esc(co.name)}</span>`;
  return `<div class="doc-letterhead">
  <div class="doc-lh-bar"></div>
  <div class="doc-lh-logo-wrap">${logo}</div>
  <div class="doc-lh-contact">${lines
    .map(
      (l) =>
        `<div class="doc-lh-row">${icon(l.icon, accent)}<div>${
          l.label ? `<div class="doc-lh-label">${esc(l.label)}</div>` : ""
        }<div class="doc-lh-text">${esc(l.text)}</div></div></div>`,
    )
    .join("")}</div>
  <div class="doc-lh-rule"><span class="thick"></span><span class="thin"></span></div>
</div>`;
}

function fill(template: string, c: ChromeInput): string {
  return template
    .replace(/\{\{\s*number\s*\}\}/g, c.number ?? "Draft")
    .replace(/\{\{\s*title\s*\}\}/g, c.title);
}

/** One page's chrome; `page`/`pages` are printed as given. */
export function pageChromeHtml(
  c: ChromeInput,
  page: number,
  pages: number,
): string {
  const s = c.settings;
  const parts: string[] = [];
  if (s.letterhead) parts.push(letterheadHtml(c));
  if (s.header) {
    parts.push(`<div class="doc-header">${esc(fill(s.header, c))}</div>`);
  }
  const footerText = s.footer ? esc(fill(s.footer, c)) : "";
  const pageNo = s.pageNumbers ? `Page ${page} of ${pages}` : "";
  if (footerText || pageNo) {
    parts.push(
      `<div class="doc-footer"><span>${footerText}</span><span class="doc-page-no">${pageNo}</span></div>`,
    );
  }
  if (s.letterhead) {
    parts.push(`<div class="doc-band">empowering healthcare</div>`);
  }
  return `<div class="doc-page" data-page="${page}" style="top:${(page - 1) * (PAGE.height + PAGE.screenGap)}px">${parts.join("")}</div>`;
}

/** Where the text column starts and stops on a page with these settings. */
export function columnMetrics(s: DocumentSettings) {
  return contentHeight({ letterhead: s.letterhead, header: Boolean(s.header) });
}

const PT = 96 / 72;

/** The CSS both surfaces share: page chrome + body typography. */
export function documentCss(
  s: DocumentSettings,
  opts: { accent?: string; screen: boolean } = { screen: true },
): string {
  const accent = opts.accent ?? ACCENT;
  const font: DocumentFont = fontById(s.font);
  const size = s.fontSize * PT;
  const gap = opts.screen ? PAGE.screenGap : 0;
  const m = columnMetrics(s);
  return `
.doc-pages{position:relative;width:${PAGE.width}px;margin:0 auto}
.doc-page{position:absolute;left:0;width:${PAGE.width}px;height:${PAGE.height}px;background:#fff;color:#1a1a1a;overflow:hidden;${
    opts.screen
      ? "box-shadow:0 1px 2px rgba(10,19,24,.12),0 10px 30px rgba(10,19,24,.16);"
      : ""
  }}
.doc-text{color:#1a1a1a;font-family:${font.family};font-size:${size.toFixed(2)}px;line-height:1.5;outline:none;white-space:pre-wrap;overflow-wrap:break-word}
.doc-column{position:absolute;left:${PAGE.padX}px;top:${m.top}px;width:${PAGE.width - 2 * PAGE.padX}px}
.doc-page-body{position:absolute;left:${PAGE.padX}px;top:${m.top}px;width:${PAGE.width - 2 * PAGE.padX}px;height:${m.height}px;overflow:hidden}
.doc-text > *{margin:0 0 ${(0.6 * size).toFixed(1)}px}
.doc-text p{min-height:${(1.5 * size).toFixed(1)}px}
.doc-text h1{font-size:1.8em;line-height:1.25;font-weight:700;margin:0.4em 0 0.5em}
.doc-text h2{font-size:1.45em;line-height:1.3;font-weight:700;margin:0.5em 0 0.4em}
.doc-text h3{font-size:1.2em;line-height:1.3;font-weight:600;margin:0.5em 0 0.35em}
.doc-text h4{font-size:1.05em;line-height:1.35;font-weight:600;margin:0.5em 0 0.3em}
.doc-text ul,.doc-text ol{padding-left:1.6em}
.doc-text ul{list-style:disc}.doc-text ol{list-style:decimal}
.doc-text li>p{margin:0}
.doc-text blockquote{border-left:3px solid ${accent};margin-left:0;padding-left:1em;color:#444}
.doc-text hr{border:0;border-top:1px solid #9a9a9a;margin:1em 0}
.doc-text a{color:#0c6b6d;text-decoration:underline}
.doc-text mark{border-radius:2px;padding:0 1px}
.doc-text table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:0.92em}
.doc-text th,.doc-text td{border:1px solid #9a9a9a;padding:4px 7px;vertical-align:top;text-align:left;position:relative}
.doc-text th{background:#eaf7f7;font-weight:600}
.doc-text td>p,.doc-text th>p{margin:0}
.doc-text img{display:block;max-width:100%;height:auto}
.doc-text img[data-align="center"]{margin-left:auto;margin-right:auto}
.doc-text img[data-align="right"]{margin-left:auto}
.doc-page-break{height:0;margin:0!important;position:relative}
.doc-signature-slot{width:230px;margin-top:1.4em;font-family:${fontById("plex-sans").family};line-height:1.3}
.doc-signature-image{height:58px;border-bottom:1px solid #1a1a1a;display:flex;align-items:flex-end}
.doc-signature-image img{max-height:56px;max-width:100%;display:block}
.doc-signature-empty{font-size:10px;color:#6d7c82;font-style:italic;padding-bottom:4px}
.doc-signature-name{font-weight:600;font-size:${(0.95 * size).toFixed(1)}px;margin-top:4px}
.doc-signature-title{font-size:${(0.82 * size).toFixed(1)}px;color:#444}
.doc-signature-line{font-size:${(0.72 * size).toFixed(1)}px;color:#6d7c82;margin-top:2px}
.doc-letterhead{position:absolute;left:0;top:0;width:100%;height:${PAGE.padTop + PAGE.letterheadHeight}px;font-family:"IBM Plex Sans","Arimo",sans-serif}
.doc-lh-bar{position:absolute;left:0;top:0;width:29px;height:${Math.round(118 * PT)}px;background:${accent}}
.doc-lh-logo-wrap{position:absolute;left:${PAGE.padX}px;top:${PAGE.padTop + 8}px;height:${Math.round(84 * PT)}px;display:flex;align-items:center}
.doc-lh-logo{width:${Math.round(190 * PT)}px;height:auto;display:block}
.doc-lh-wordmark{font-weight:700;font-size:24px;color:#1a1a1a}
.doc-lh-contact{position:absolute;right:${Math.round(-32 * PT) + PAGE.padX}px;top:${PAGE.padTop}px;width:${Math.round(158 * PT)}px;font-size:9.5px;line-height:1.2;color:#1a1a1a}
.doc-lh-row{display:flex;gap:8px;margin-bottom:5px;align-items:flex-start}
.doc-lh-icon{width:16px;height:16px;flex:none;margin-top:1px}
.doc-lh-icon svg{width:16px;height:16px;display:block}
.doc-lh-label{font-weight:700}
.doc-lh-rule{position:absolute;left:0;right:0;top:${PAGE.padTop + PAGE.letterheadHeight - 10}px;height:10px}
.doc-lh-rule .thick{position:absolute;left:0;bottom:0;width:${Math.round(250 * PT)}px;height:9px;background:${accent}}
.doc-lh-rule .thin{position:absolute;left:0;right:0;bottom:0;height:1px;background:${accent}}
.doc-header{position:absolute;left:${PAGE.padX}px;right:${PAGE.padX}px;top:${s.letterhead ? PAGE.padTop + PAGE.letterheadHeight + 6 : PAGE.plainTop}px;font-family:"IBM Plex Sans","Arimo",sans-serif;font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.doc-footer{position:absolute;left:${PAGE.padX}px;right:${PAGE.padX}px;bottom:${PAGE.padBottom + 2}px;display:flex;justify-content:space-between;gap:16px;font-family:"IBM Plex Sans","Arimo",sans-serif;font-size:9.5px;color:#444;border-top:1px solid #d9d9d9;padding-top:4px}
.doc-page-no{font-family:"IBM Plex Mono",monospace;white-space:nowrap}
.doc-band{position:absolute;left:0;right:0;bottom:0;background:${accent};color:#fff;text-align:center;font-family:"IBM Plex Sans","Arimo",sans-serif;font-size:12px;letter-spacing:4px;padding:9px 0 8px}
.doc-gap{height:${gap}px}
`;
}
