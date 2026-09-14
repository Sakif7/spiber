import type { DocumentBody } from "@/lib/schemas/authored-document";

/**
 * Signature slots inside a body, as plain JSON: listing them, drawing the
 * given signatures into them for a render, stripping that state before a
 * save. No editor or browser imports — the client dialogs use it too.
 */
/** A signature slot as written into the body. */
export type SlotRef = {
  slotId: string;
  employeeId: string;
  name: string;
  title: string;
  label: string;
};

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

function walkNodes(node: JsonNode, visit: (n: JsonNode) => void) {
  visit(node);
  if (Array.isArray(node.content))
    for (const c of node.content) walkNodes(c, visit);
}

/** Every signature slot in the body, in document order. */
export function slotsIn(body: DocumentBody): SlotRef[] {
  const out: SlotRef[] = [];
  walkNodes(body as JsonNode, (n) => {
    if (n.type !== "signatureSlot") return;
    const a = n.attrs ?? {};
    out.push({
      slotId: String(a.slotId ?? ""),
      employeeId: String(a.employeeId ?? ""),
      name: String(a.name ?? ""),
      title: String(a.title ?? ""),
      label: String(a.label ?? "Signature"),
    });
  });
  return out;
}

/** What a signed slot shows: the image (a URL or data URI) and the date line. */
export type SlotSignature = { image: string; line: string };

/**
 * A copy of the body with the signed slots filled in — the image and the
 * "Signed …" line are render-time state, keyed by employee, never stored
 * in the document itself. Unsigned slots keep their placeholder.
 */
export function withSignatures(
  body: DocumentBody,
  signed: Map<string, SlotSignature>,
): DocumentBody {
  if (signed.size === 0) return stripSignatureState(body);
  const copy = JSON.parse(JSON.stringify(body)) as JsonNode;
  walkNodes(copy, (n) => {
    if (n.type !== "signatureSlot") return;
    const a = (n.attrs ??= {});
    const sig = signed.get(String(a.employeeId ?? ""));
    a.signedImage = sig ? sig.image : null;
    a.signedLine = sig ? sig.line : null;
  });
  return copy as DocumentBody;
}

/** The body as it is stored: no signature images or lines on any slot. */
export function stripSignatureState(body: DocumentBody): DocumentBody {
  let dirty = false;
  walkNodes(body as JsonNode, (n) => {
    if (
      n.type === "signatureSlot" &&
      n.attrs &&
      (n.attrs.signedImage || n.attrs.signedLine)
    )
      dirty = true;
  });
  if (!dirty) return body;
  const copy = JSON.parse(JSON.stringify(body)) as JsonNode;
  walkNodes(copy, (n) => {
    if (n.type === "signatureSlot" && n.attrs) {
      n.attrs.signedImage = null;
      n.attrs.signedLine = null;
    }
  });
  return copy as DocumentBody;
}
