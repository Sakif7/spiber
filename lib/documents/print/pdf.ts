import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { companyContext } from "@/lib/pdf/engine/context";
import { publicImage } from "@/lib/pdf/engine/assets";
import { PAGE, fontFaceCss } from "@/lib/documents/types";
import {
  documentCss,
  pageChromeHtml,
  columnMetrics,
  type ChromeInput,
} from "@/lib/documents/chrome";
import { pagerSource } from "@/lib/documents/pager";
import { bodyToHtml } from "@/lib/documents/render";
import type {
  DocumentBody,
  DocumentSettings,
} from "@/lib/schemas/authored-document";
import { getBrowser, PrintError } from "./browser";

/**
 * A document → PDF, by printing the editor's own HTML in Chromium: same
 * CSS, same fonts (embedded as data URIs so the page needs no network),
 * same pager (injected as source) — so the paper matches the screen.
 */
export type PrintInput = {
  body: DocumentBody;
  settings: DocumentSettings;
  number: string | null;
  title: string;
};

export type PrintResult = { pdf: Buffer; pages: number; sha256: string };

const fontCache = new Map<string, string>();

function fontDataUri(file: string): string {
  const hit = fontCache.get(file);
  if (hit) return hit;
  const p = path.join(process.cwd(), "public", "fonts", "docs", file);
  const uri = `data:font/woff;base64,${fs.readFileSync(p).toString("base64")}`;
  fontCache.set(file, uri);
  return uri;
}

let logoCache: string | null | undefined;
function logoDataUri(): string | null {
  if (logoCache !== undefined) return logoCache;
  const buf = publicImage("letterhead-logo.png");
  logoCache = buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
  return logoCache;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The complete print page. Exported so a test can inspect it without a browser. */
export function printHtml(input: PrintInput): string {
  const chrome: ChromeInput = {
    settings: input.settings,
    company: companyContext(),
    number: input.number,
    title: input.title,
    logoSrc: logoDataUri(),
  };
  const m = columnMetrics(input.settings);
  const chromeTemplate = pageChromeHtml(chrome, 0, 0)
    // The pager fills these in per page.
    .replace(/Page 0 of 0/g, "Page __PAGE__ of __PAGES__")
    .replace(/data-page="0"/, 'data-page="__PAGE__"')
    .replace(/style="top:[^"]*"/, 'style="top:__TOP__px"');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(input.title)}</title>
<style>
${fontFaceCss(fontDataUri)}
@page{size:${PAGE.width}px ${PAGE.height}px;margin:0}
html,body{margin:0;padding:0;background:#fff}
${documentCss(input.settings, { screen: false })}
/* On paper every page is its own in-flow block: no cross-page fragmentation. */
.doc-pages{height:auto}
.doc-page{position:relative!important;top:auto!important;break-after:page;page-break-after:always}
.doc-page:last-child{break-after:auto;page-break-after:auto}
</style></head>
<body>
<div class="doc-pages" id="pages"></div>
<div class="doc-column doc-text" id="column">${bodyToHtml(input.body)}</div>
<script>
${pagerSource()}
(function () {
  var TEMPLATE = ${JSON.stringify(chromeTemplate)};
  var PAGE_H = ${PAGE.height};
  function run() {
    var column = document.getElementById("column");
    var pages = document.getElementById("pages");
    var metrics = { pageHeight: PAGE_H, contentTop: ${m.top}, contentBottom: ${m.bottom}, gap: 0 };
    // One clean pass over the untouched column (the pusher stylesheet is
    // never needed here: every page gets its own blocks instead).
    var r = window.__paginate(column, metrics, ".doc-column");
    var html = "";
    for (var p = 1; p <= r.pages; p++) {
      html += TEMPLATE.replace(/__PAGE__/g, String(p)).replace(/__PAGES__/g, String(r.pages)).replace(/__TOP__/g, String((p - 1) * PAGE_H));
    }
    pages.innerHTML = html;
    var blocks = Array.prototype.slice.call(column.children);
    for (var p2 = 1; p2 <= r.pages; p2++) {
      var body = document.createElement("div");
      body.className = "doc-page-body doc-text";
      pages.children[p2 - 1].appendChild(body);
      for (var i = 0; i < blocks.length; i++) {
        if (r.pageOfBlock[i] === p2) body.appendChild(blocks[i]);
      }
    }
    column.remove();
    window.__pageCount = r.pages;
    window.__paged = true;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
})();
</script>
</body></html>`;
}

export async function renderDocumentPdf(
  input: PrintInput,
): Promise<PrintResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: PAGE.width,
      height: PAGE.height,
      deviceScaleFactor: 1,
    });
    await page.setContent(printHtml(input), {
      waitUntil: "load",
      timeout: 30_000,
    });
    await page.waitForFunction("window.__paged === true", { timeout: 30_000 });
    const pages = (await page.evaluate("window.__pageCount")) as number;
    const pdf = Buffer.from(
      await page.pdf({
        width: `${PAGE.width}px`,
        height: `${PAGE.height}px`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
    return {
      pdf,
      pages,
      sha256: createHash("sha256").update(pdf).digest("hex"),
    };
  } catch (e) {
    if (e instanceof PrintError) throw e;
    throw new PrintError("render_failed", String(e));
  } finally {
    await page.close().catch(() => undefined);
  }
}
