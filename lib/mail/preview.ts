/**
 * The one-line preview under a subject in the message list. The IMAP store
 * fetches only the first few KB of the message's text part (no full
 * download), decodes the transfer encoding and charset here, and boils it
 * down to plain words; the memory store runs the same reduction over its
 * fixtures so both stores show identical previews.
 */
export const PREVIEW_CHARS = 200;

export type PreviewPart = {
  /** IMAP body part id, e.g. "1" or "1.2". */
  key: string;
  encoding: string;
  charset: string;
  html: boolean;
};

type StructureNode = {
  part?: string;
  type?: string;
  encoding?: string;
  disposition?: string;
  parameters?: Record<string, string>;
  childNodes?: StructureNode[];
};

/** Prefer the first text/plain leaf, else the first text/html; skip attachments. */
export function pickPreviewPart(
  node?: StructureNode | null,
): PreviewPart | null {
  if (!node) return null;
  const leaves: StructureNode[] = [];
  const walk = (n: StructureNode) => {
    if (n.childNodes?.length) n.childNodes.forEach(walk);
    else leaves.push(n);
  };
  walk(node);
  const isText = (t: string) => (n: StructureNode) =>
    (n.type ?? "").toLowerCase() === t &&
    (n.disposition ?? "").toLowerCase() !== "attachment";
  const leaf =
    leaves.find(isText("text/plain")) ?? leaves.find(isText("text/html"));
  if (!leaf) return null;
  return {
    // A single-part message has no part number; its body is part "1".
    key: leaf.part ?? "1",
    encoding: (leaf.encoding ?? "7bit").toLowerCase(),
    charset: leaf.parameters?.charset ?? "utf-8",
    html: (leaf.type ?? "").toLowerCase() === "text/html",
  };
}

function decodeQuotedPrintable(buf: Buffer): Buffer {
  // Soft line breaks vanish; =XX becomes the byte.
  const s = buf.toString("latin1").replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(s.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** Transfer-decode a partial body and turn its bytes into a string. */
export function decodePart(
  raw: Buffer,
  encoding: string,
  charset: string,
): string {
  let bytes = raw;
  if (encoding === "quoted-printable") bytes = decodeQuotedPrintable(raw);
  else if (encoding === "base64") {
    // A partial fetch may cut mid-quantum; drop the ragged tail.
    const clean = raw.toString("latin1").replace(/[^A-Za-z0-9+/=]/g, "");
    bytes = Buffer.from(
      clean.slice(0, clean.length - (clean.length % 4)),
      "base64",
    );
  }
  try {
    return new TextDecoder(charset || "utf-8", { fatal: false }).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function stripHtml(html: string): string {
  let s = html;
  // A partial fetch can stop inside <head>; keep only what follows <body>.
  const body = s.search(/<body[\s>]/i);
  if (body >= 0) s = s.slice(body);
  s = s
    .replace(/<(style|script|head|title)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(style|script|head)[^>]*>[\s\S]*$/i, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    // A cut-off tag at the end of the window.
    .replace(/<[^>]*$/, "");
  return decodeEntities(s);
}

/** The named entities the editor and most mail emit, plus numeric ones. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1].toLowerCase() === "x"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Collapse a body (plain or HTML) into one line of at most PREVIEW_CHARS. */
export function previewText(
  body: string | null | undefined,
  html = false,
): string {
  if (!body) return "";
  const flat = (html ? stripHtml(body) : body)
    // Quoted replies and signatures are noise in a one-liner.
    .split(/\r?\n(?=>|-- ?(?:\r?\n|$))/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > PREVIEW_CHARS
    ? `${flat.slice(0, PREVIEW_CHARS - 1).trimEnd()}…`
    : flat;
}
