import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import {
  SIGNATURE_LOGO_ALT,
  SIGNATURE_LOGO_HEIGHT,
  SIGNATURE_LOGO_SRC,
  SIGNATURE_LOGO_WIDTH,
} from "@/lib/mail/signature";

/**
 * The composer's three structural pieces beyond ordinary rich text.
 *
 * A message is laid out as: what is typed, then the signature block, then
 * the quoted original. Keeping the signature and the quote as nodes of
 * their own is what lets the signature picker swap exactly one block — and
 * put a signature back above the quote after it was deleted — without ever
 * touching what the person wrote. On the wire both are plain `<div>`s (the
 * outgoing sanitiser drops the data attributes).
 */

export const MailSignature = Node.create({
  name: "mailSignature",
  group: "block",
  content: "block+",
  defining: true,
  // Backspace at its first line does not pull the signature into the body.
  isolating: true,
  parseHTML() {
    return [{ tag: "div[data-mail-signature]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-mail-signature": "" }),
      0,
    ];
  },
});

export const MailQuote = Node.create({
  name: "mailQuote",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-mail-quote]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-mail-quote": "" }),
      0,
    ];
  },
});

/**
 * The company logo in a signature. Whatever it was parsed from, it draws our
 * own file; the send path turns it into an inline `cid:` part.
 */
export const MailLogo = Node.create({
  name: "mailLogo",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [{ tag: "img[data-mail-logo]" }];
  },
  renderHTML() {
    return [
      "img",
      {
        "data-mail-logo": "",
        src: SIGNATURE_LOGO_SRC,
        alt: SIGNATURE_LOGO_ALT,
        width: String(SIGNATURE_LOGO_WIDTH),
        height: String(SIGNATURE_LOGO_HEIGHT),
      },
    ];
  },
});

export const MAIL_NODES = [MailSignature, MailQuote, MailLogo];

/** A signature as a block of its own; nothing when there is none. */
export function signatureBlock(html: string | null | undefined): string {
  return html ? `<div data-mail-signature="">${html}</div>` : "";
}

/** The first empty line to type on, the signature, then the quote. */
export function initialMailHtml({
  signature,
  quote,
}: {
  signature?: string | null;
  quote?: string | null;
}): string {
  return [
    "<p></p>",
    signatureBlock(signature),
    quote ? `<div data-mail-quote="">${quote}</div>` : "",
  ].join("");
}

/**
 * Put a signature in its place: swap the block, drop it (`null`), or — when
 * it was deleted by hand — add it back above the quote, or else under the
 * last line that has anything in it. (The editor keeps an empty line at the
 * very end; putting the signature after that would leave a gap above it.)
 */
export function applySignature(editor: Editor, html: string | null): void {
  const { doc } = editor.state;
  const found: {
    signature: { from: number; to: number } | null;
    quoteAt: number | null;
    // End of the typing line at least, then of the last line with content.
    afterText: number;
  } = { signature: null, quoteAt: null, afterText: 0 };
  doc.forEach((node, offset, index) => {
    if (node.type.name === "mailSignature" && !found.signature) {
      found.signature = { from: offset, to: offset + node.nodeSize };
    }
    if (node.type.name === "mailQuote" && found.quoteAt === null) {
      found.quoteAt = offset;
    }
    if (found.quoteAt === null && (index === 0 || node.content.size > 0)) {
      found.afterText = offset + node.nodeSize;
    }
  });
  const block = signatureBlock(html) || null;
  const chain = editor.chain();
  if (found.signature) {
    if (block) {
      chain.insertContentAt(found.signature, block, { updateSelection: false });
    } else {
      chain.deleteRange(found.signature);
    }
  } else if (block) {
    chain.insertContentAt(found.quoteAt ?? found.afterText, block, {
      updateSelection: false,
    });
  }
  chain.run();
}
