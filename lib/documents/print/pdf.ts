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
    // Footnotes: number the references in reading order and measure each
    // note in the foot block's own styling, so the pager keeps exactly the
    // room the notes will take.
    var refs = column.querySelectorAll("[data-footnote]");
    var noteNumber = {};
    for (var f = 0; f < refs.length; f++) {
      noteNumber[refs[f].getAttribute("data-footnote")] = f + 1;
      refs[f].textContent = String(f + 1);
    }
    var measure = document.createElement("div");
    measure.className = "doc-footnotes";
    measure.style.cssText = "visibility:hidden;position:absolute;top:0;border-top:0;padding-top:0";
    var mItem = document.createElement("div");
    mItem.className = "doc-footnote-item";
    var mNum = document.createElement("span");
    mNum.className = "doc-footnote-num";
    mNum.textContent = "9.";
    var mText = document.createElement("span");
    mText.className = "doc-footnote-text";
    mItem.appendChild(mNum);
    mItem.appendChild(mText);
    measure.appendChild(mItem);
    pages.parentNode.insertBefore(measure, pages);
    var heights = {};
    var notes = {
      separator: 9,
      heightOf: function (ref) {
        var note = ref.getAttribute("data-note") || "";
        if (heights[note] !== undefined) return heights[note];
        mText.textContent = note || " ";
        heights[note] = mItem.offsetHeight + 2;
        return heights[note];
      },
    };
    // One clean pass over the untouched column (the pusher stylesheet is
    // never needed here: every page gets its own blocks instead). A table of
    // contents is filled from that pass and the column paginated once more,
    // because the filled list has height the first pass did not see.
    var r = window.__paginate(column, metrics, ".doc-column", notes);
    var tocs = column.querySelectorAll("[data-toc]");
    if (tocs.length) {
      var fill = function (pageOf) {
        Array.prototype.forEach.call(tocs, function (toc) {
          var depth = Number(toc.getAttribute("data-toc")) || 3;
          var list = toc.querySelector(".doc-toc-list");
          if (!list) return;
          list.innerHTML = "";
          var blocks = column.children;
          for (var i = 0; i < blocks.length; i++) {
            var m = /^H([1-6])$/.exec(blocks[i].tagName);
            if (!m || Number(m[1]) > depth || !blocks[i].textContent.trim()) continue;
            var li = document.createElement("li");
            li.className = "doc-toc-item level-" + m[1];
            var text = document.createElement("span");
            text.className = "doc-toc-text";
            text.textContent = blocks[i].textContent;
            var page = document.createElement("span");
            page.className = "doc-toc-page";
            page.textContent = String(pageOf[i] || "");
            li.appendChild(text);
            li.appendChild(page);
            list.appendChild(li);
          }
        });
      };
      fill(r.pageOfBlock);
      r = window.__paginate(column, metrics, ".doc-column", notes);
      fill(r.pageOfBlock);
    }
    measure.remove();
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
      // This page's notes, at its foot.
      var ids = r.notesByPage[p2 - 1] || [];
      if (ids.length) {
        var foot = document.createElement("div");
        foot.className = "doc-footnotes";
        foot.style.bottom = String(metrics.contentBottom) + "px";
        for (var k = 0; k < ids.length; k++) {
          var ref = column.querySelector('[data-footnote="' + ids[k] + '"]') || pages.querySelector('[data-footnote="' + ids[k] + '"]');
          var item = document.createElement("div");
          item.className = "doc-footnote-item";
          var num = document.createElement("span");
          num.className = "doc-footnote-num";
          num.textContent = String(noteNumber[ids[k]] || "*") + ".";
          var text = document.createElement("span");
          text.className = "doc-footnote-text";
          text.textContent = (ref && ref.getAttribute("data-note")) || " ";
          item.appendChild(num);
          item.appendChild(text);
          foot.appendChild(item);
        }
        pages.children[p2 - 1].appendChild(foot);
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
