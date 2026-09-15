"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { anchorFor, type TextAnchor } from "@/lib/documents/anchors";
import { PAGE } from "@/lib/documents/types";
import { stackPoint } from "./page-stack";

const NONE = { from: 0, to: 0, text: false };

/** The editor's selection: where it is, and whether it covers any text. */
function useSelection(editor: Editor | null) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!editor) return () => undefined;
      editor.on("selectionUpdate", onChange);
      editor.on("update", onChange);
      editor.on("blur", onChange);
      return () => {
        editor.off("selectionUpdate", onChange);
        editor.off("update", onChange);
        editor.off("blur", onChange);
      };
    },
    [editor],
  );
  const cache = useRef(NONE);
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!editor || editor.isDestroyed) return NONE;
      const sel = editor.state.selection;
      const text =
        sel instanceof TextSelection &&
        !sel.empty &&
        editor.state.doc.textBetween(sel.from, sel.to, " ", " ").trim().length >
          0;
      const c = cache.current;
      if (c.from === sel.from && c.to === sel.to && c.text === text) return c;
      cache.current = { from: sel.from, to: sel.to, text };
      return cache.current;
    },
    () => NONE,
  );
}

/**
 * Select some words, and a small "Comment" button appears under them;
 * press it and a card opens for the note. The card stays while typing,
 * whatever the editor's selection does meanwhile — the words were
 * captured when the button was pressed.
 */
export function CommentBubble({
  editor,
  enabled,
  onSubmit,
}: {
  editor: Editor | null;
  enabled: boolean;
  onSubmit: (input: TextAnchor & { text: string }) => Promise<boolean>;
}) {
  const sel = useSelection(editor);
  const [composing, setComposing] = useState<null | {
    anchor: TextAnchor;
    left: number;
    top: number;
  }>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!editor || !enabled) return null;

  const place = (pos: number) => {
    const stack = (editor.view.dom as HTMLElement).parentElement;
    if (!stack) return null;
    const c = editor.view.coordsAtPos(pos);
    const p = stackPoint(stack, c.left, c.bottom);
    return { left: Math.min(p.left, PAGE.width - 340), top: p.top + 6 };
  };

  const start = () => {
    const at = place(sel.to);
    if (!at) return;
    setComposing({
      anchor: anchorFor(editor.state.doc, sel.from, sel.to),
      ...at,
    });
    setText("");
  };

  const submit = async () => {
    if (!composing || !text.trim()) return;
    setBusy(true);
    try {
      const ok = await onSubmit({ ...composing.anchor, text: text.trim() });
      if (ok) {
        setComposing(null);
        setText("");
      }
    } finally {
      setBusy(false);
    }
  };

  if (composing) {
    return (
      <div
        role="dialog"
        aria-label="New comment"
        className="bg-popover text-popover-foreground absolute z-20 w-80 rounded-md border p-2 shadow-md"
        style={{ left: composing.left, top: composing.top }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setComposing(null);
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <p className="text-muted-foreground mb-1.5 truncate text-xs italic">
          “{composing.anchor.quote}”
        </p>
        <Textarea
          value={text}
          autoFocus
          rows={3}
          maxLength={4000}
          placeholder="Your comment"
          className="text-sm"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setComposing(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Comment
          </Button>
        </div>
      </div>
    );
  }

  if (!sel.text) return null;
  const at = place(sel.to);
  if (!at) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="absolute z-20 shadow-md"
      style={{ left: at.left, top: at.top }}
      // Keep the editor's selection: the button must not take it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={start}
    >
      <MessageSquarePlus className="size-4" aria-hidden />
      Comment
    </Button>
  );
}
