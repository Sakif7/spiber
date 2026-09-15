"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { footnotesIn } from "@/lib/documents/extensions";
import { PAGE } from "@/lib/documents/types";
import { useEditorStat } from "./use-editor-stat";
import type { PagerState } from "./use-pager";

/** The notes drawn at the foot of each page, where the pager reserved room. */
export function PageFootnotes({
  editor,
  pager,
  contentBottom,
}: {
  editor: Editor | null;
  pager: PagerState;
  contentBottom: number;
}) {
  const notes = useEditorStat(
    editor,
    (e) => footnotesIn(e.state.doc),
    EMPTY_NOTES,
    (a, b) =>
      a.length === b.length &&
      a.every((x, i) => x.id === b[i].id && x.text === b[i].text),
  );
  const stride = PAGE.height + PAGE.screenGap;
  return (
    <>
      {pager.notesByPage.map((ids, page) =>
        ids.length === 0 ? null : (
          <div
            key={page}
            className="doc-footnotes"
            aria-label={`Footnotes, page ${page + 1}`}
            style={{
              top:
                page * stride +
                PAGE.height -
                contentBottom -
                (pager.notesHeight[page] ?? 0),
            }}
          >
            {ids.map((id) => {
              const note = notes.find((n) => n.id === id);
              return (
                <div key={id} className="doc-footnote-item">
                  <span className="doc-footnote-num">{note?.n ?? "*"}.</span>
                  <span className="doc-footnote-text">{note?.text || " "}</span>
                </div>
              );
            })}
          </div>
        ),
      )}
    </>
  );
}

const EMPTY_NOTES: { id: string; text: string; n: number }[] = [];

function useOpenFootnote(editor: Editor | null): string | null {
  return useSyncExternalStore(
    (cb) => {
      const storage = editor?.storage.footnote;
      storage?.listeners.add(cb);
      return () => {
        storage?.listeners.delete(cb);
      };
    },
    () => editor?.storage.footnote?.open ?? null,
    () => null,
  );
}

/**
 * The little card that opens under a footnote reference: its text, and a
 * way to remove it. Positioned inside the page stack next to the
 * reference, in the stack's own coordinates so zoom keeps it in place.
 */
export function FootnotePopover({ editor }: { editor: Editor | null }) {
  const open = useOpenFootnote(editor);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!editor || !open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing clears the card
      setPos(null);
      return;
    }
    const dom = editor.view.dom as HTMLElement;
    const ref = dom.querySelector<HTMLElement>(`[data-footnote="${open}"]`);
    const stack = dom.parentElement;
    if (!ref || !stack) {
      setPos(null);
      return;
    }
    const r = ref.getBoundingClientRect();
    const s = stack.getBoundingClientRect();
    const scale = s.width / stack.offsetWidth || 1;
    setPos({
      left: Math.min((r.left - s.left) / scale, PAGE.width - 340),
      top: (r.bottom - s.top) / scale + 6,
    });
    setDraft(ref.getAttribute("data-note") ?? "");
  }, [editor, open]);

  if (!editor || !open || !pos) return null;
  const close = () => {
    editor.commands.setFootnoteOpen(null);
    editor.commands.focus();
  };

  return (
    <div
      role="dialog"
      aria-label="Footnote"
      className="bg-popover text-popover-foreground absolute z-20 w-80 rounded-md border p-2 shadow-md"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
    >
      <Textarea
        value={draft}
        autoFocus
        rows={3}
        placeholder="The note, as it will read at the foot of the page"
        className="text-sm"
        onChange={(e) => {
          setDraft(e.target.value);
          editor.commands.setFootnoteText(open, e.target.value);
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            editor.commands.removeFootnote(open);
            close();
          }}
        >
          <Trash2 className="size-4" /> Remove
        </Button>
        <Button type="button" size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}
