import { generateHTML } from "@tiptap/html/server";
import { documentExtensions } from "./extensions";
import type { DocumentBody } from "@/lib/schemas/authored-document";

/**
 * TipTap JSON → the HTML the editor would show. Throws on a node the schema
 * does not know, which is what we want: a body that cannot render must not
 * be filed.
 */
export function bodyToHtml(body: DocumentBody): string {
  return generateHTML(body as never, documentExtensions());
}

/** Rough plain text of a body — for search and previews. */
export function bodyToText(body: DocumentBody): string {
  const out: string[] = [];
  const walk = (node: {
    type?: string;
    text?: string;
    content?: unknown[];
  }) => {
    if (node.text) out.push(node.text);
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c as never);
      if (node.type !== "doc") out.push("\n");
    }
  };
  walk(body as never);
  return out
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** The empty document every new file starts from. */
export function emptyBody(): DocumentBody {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
