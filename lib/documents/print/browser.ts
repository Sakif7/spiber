import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { logger } from "@/lib/log";

/**
 * The one Chromium the printer drives. Found, in order: `DOCS_CHROME_PATH`
 * (production sets it to the image's chromium), then the usual places on a
 * developer machine (Playwright's download, Chrome, Edge). Launched once
 * and kept; if it dies, the next print relaunches it.
 *
 * Without any browser the printer throws `chrome_not_found` and the API
 * answers 503 — a document is never silently filed without its PDF.
 */
export class PrintError extends Error {
  constructor(
    public readonly code: "chrome_not_found" | "render_failed",
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PrintError";
  }
}

function candidates(): string[] {
  const list: string[] = [];
  const env = process.env.DOCS_CHROME_PATH?.trim();
  if (env) {
    // A bare name ("chromium") is looked up on PATH — that is where a nix
    // package lands on the production image.
    if (env.includes("/") || env.includes("\\")) {
      list.push(env);
    } else {
      for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
        if (dir) list.push(path.join(dir, env));
      }
    }
  }
  if (process.platform === "win32") {
    const local =
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData/Local");
    const pw = path.join(local, "ms-playwright");
    try {
      for (const d of fs.readdirSync(pw)) {
        if (/^chromium-\d+$/.test(d)) {
          list.push(path.join(pw, d, "chrome-win", "chrome.exe"));
          list.push(path.join(pw, d, "chrome-win64", "chrome.exe"));
        }
      }
    } catch {
      /* no playwright browsers */
    }
    list.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    );
  } else if (process.platform === "darwin") {
    list.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    list.push(
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    );
    const pw = path.join(os.homedir(), ".cache/ms-playwright");
    try {
      for (const d of fs.readdirSync(pw)) {
        if (/^chromium-\d+$/.test(d))
          list.push(path.join(pw, d, "chrome-linux", "chrome"));
      }
    } catch {
      /* none */
    }
  }
  return list;
}

export function chromePath(): string | null {
  for (const p of candidates()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* unreadable */
    }
  }
  return null;
}

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
    browserPromise = null;
  }
  const executablePath = chromePath();
  if (!executablePath) throw new PrintError("chrome_not_found");
  browserPromise = puppeteer
    .launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    })
    .then((b) => {
      b.on("disconnected", () => {
        browserPromise = null;
      });
      logger.info("documents: chromium started", { executablePath });
      return b;
    });
  return browserPromise;
}

/** For tests and shutdown. */
export async function closeBrowser(): Promise<void> {
  const p = browserPromise;
  browserPromise = null;
  if (p) await (await p.catch(() => null))?.close().catch(() => undefined);
}
