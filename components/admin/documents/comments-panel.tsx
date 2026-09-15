"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { Check, Loader2, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/http/form-error";
import type {
  CommentView,
  ReviewState,
} from "@/lib/services/documents/document-review.service";
import { anchorsKey, type AnchorsState } from "./comment-anchors";

/** Where the panel talks to: the author's routes or the reviewer's. */
export type CommentEndpoints = {
  list: string;
  add: string;
  reply: (commentId: string) => string;
  /** Only the author's side may resolve. */
  resolve?: (commentId: string) => string;
};

const POLL_MS = 20_000;

export async function postJson<T>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<
  { ok: true; data: T } | { ok: false; code: string; message: string }
> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    return {
      ok: false,
      code: json?.error?.code ?? `http_${res.status}`,
      message: formatApiError(json, "Request failed."),
    };
  }
  return { ok: true, data: json.data as T };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const EMPTY_RANGES: AnchorsState["ranges"] = {};

/** The anchor plugin's ranges, fresh after every transaction. */
function useRanges(editor: Editor | null): AnchorsState["ranges"] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!editor) return () => undefined;
      editor.on("transaction", onChange);
      return () => {
        editor.off("transaction", onChange);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      editor && !editor.isDestroyed
        ? (anchorsKey.getState(editor.state)?.ranges ?? EMPTY_RANGES)
        : EMPTY_RANGES,
    () => EMPTY_RANGES,
  );
}

function useCurrent(editor: Editor | null): string | null {
  return useSyncExternalStore(
    (cb) => {
      const storage = editor?.storage.commentAnchors;
      storage?.listeners.add(cb);
      return () => {
        storage?.listeners.delete(cb);
      };
    },
    () => editor?.storage.commentAnchors?.current ?? null,
    () => null,
  );
}

/**
 * The threads on this document, in reading order — the ones whose words
 * are gone come last, flagged. Anyone may reply; only the author resolves.
 * Refreshed every twenty seconds while the tab is visible, so the author
 * sees a reviewer's comment land without reloading (and the other way
 * round).
 */
export function CommentsPanel({
  editor,
  state,
  onState,
  endpoints,
  canResolve,
  open,
  header,
}: {
  editor: Editor | null;
  state: ReviewState;
  onState: (s: ReviewState) => void;
  endpoints: CommentEndpoints;
  canResolve: boolean;
  /** Whether new comments may be written (draft or in review). */
  open: boolean;
  header?: ReactNode;
}) {
  const ranges = useRanges(editor);
  const current = useCurrent(editor);
  const [showResolved, setShowResolved] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(endpoints.list).catch(() => null);
      const json = res && res.ok ? await res.json().catch(() => null) : null;
      if (json?.ok) onState(json.data as ReviewState);
    };
    const id = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(id);
  }, [endpoints.list, onState]);

  const threads = [...state.comments].sort((a, b) => {
    const ra = ranges[a.id];
    const rb = ranges[b.id];
    if (ra && rb) return ra.from - rb.from;
    if (ra) return -1;
    if (rb) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const openThreads = threads.filter((t) => !t.resolvedAt);
  const resolved = threads.length - openThreads.length;
  const shown = showResolved ? threads : openThreads;

  function focus(t: CommentView) {
    if (!editor) return;
    editor.commands.setCurrentComment(t.id);
    const r = ranges[t.id];
    if (!r) return;
    const at = editor.view.domAtPos(r.from).node;
    const el =
      at.nodeType === Node.TEXT_NODE ? at.parentElement : (at as Element);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function addGeneral(text: string) {
    const res = await postJson<ReviewState>(endpoints.add, {
      text,
      quote: "",
      prefix: "",
      suffix: "",
      at: 0,
    });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    onState(res.data);
    setComposing(false);
    return true;
  }

  async function reply(t: CommentView, text: string) {
    const res = await postJson<ReviewState>(endpoints.reply(t.id), { text });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    onState(res.data);
    return true;
  }

  async function resolve(t: CommentView, resolved: boolean) {
    if (!endpoints.resolve) return;
    const res = await postJson<ReviewState>(
      endpoints.resolve(t.id),
      { resolved },
      "PATCH",
    );
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    onState(res.data);
    if (resolved && current === t.id) editor?.commands.setCurrentComment(null);
  }

  return (
    <div className="space-y-3">
      {header}
      {open && (
        <div>
          {composing ? (
            <Composer
              placeholder="A comment on the document as a whole"
              onCancel={() => setComposing(false)}
              onSubmit={addGeneral}
              label="Comment"
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setComposing(true)}
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              Comment on the document
            </Button>
          )}
          <p className="text-muted-foreground mt-1.5 text-xs">
            Or select words in the text and press “Comment”.
          </p>
        </div>
      )}
      {resolved > 0 && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="show-resolved" className="text-xs font-normal">
            Show resolved ({resolved})
          </Label>
          <Switch
            id="show-resolved"
            checked={showResolved}
            onCheckedChange={setShowResolved}
          />
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {threads.length === 0
            ? open
              ? "No comments yet."
              : "No comments were made on this document."
            : "Every thread is resolved."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              current={current === t.id}
              detached={Boolean(t.quote) && !ranges[t.id]}
              canResolve={canResolve}
              open={open}
              onFocus={() => focus(t)}
              onReply={(text) => reply(t, text)}
              onResolve={(v) => void resolve(t, v)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Thread({
  thread: t,
  current,
  detached,
  canResolve,
  open,
  onFocus,
  onReply,
  onResolve,
}: {
  thread: CommentView;
  current: boolean;
  detached: boolean;
  canResolve: boolean;
  open: boolean;
  onFocus: () => void;
  onReply: (text: string) => Promise<boolean>;
  onResolve: (resolved: boolean) => void;
}) {
  const [replying, setReplying] = useState(false);
  const done = Boolean(t.resolvedAt);
  return (
    <li
      data-thread={t.id}
      className={`rounded-md border p-2.5 ${current ? "ring-primary/40 border-primary ring-2" : ""} ${done ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onFocus}
        aria-label={`Go to the comment by ${t.authorName}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{t.authorName}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {when(t.createdAt)}
          </span>
        </div>
        {t.quote ? (
          <p
            className={`mt-0.5 truncate text-xs italic ${detached ? "text-destructive" : "text-muted-foreground"}`}
            title={t.quote}
          >
            “{t.quote}”{detached ? " — no longer in the text" : ""}
          </p>
        ) : (
          <p className="text-muted-foreground mt-0.5 text-xs">
            On the document
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap">{t.text}</p>
      </button>
      {t.replies.length > 0 && (
        <ul className="border-border mt-2 space-y-1.5 border-l-2 pl-2.5">
          {t.replies.map((r, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">
                  {r.authorName}
                </span>
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  {when(r.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
      {done && (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
          <Check className="size-3" aria-hidden /> Resolved{" "}
          {when(t.resolvedAt as string)}
        </p>
      )}
      {open && (
        <div className="mt-2">
          {replying ? (
            <Composer
              placeholder="Your reply"
              label="Reply"
              onCancel={() => setReplying(false)}
              onSubmit={async (text) => {
                const ok = await onReply(text);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplying(true)}
              >
                Reply
              </Button>
              {canResolve &&
                (done ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onResolve(false)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden /> Reopen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onResolve(true)}
                  >
                    <Check className="size-3.5" aria-hidden /> Resolve
                  </Button>
                ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Composer({
  placeholder,
  label,
  onCancel,
  onSubmit,
}: {
  placeholder: string;
  label: string;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <Textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={4000}
        placeholder={placeholder}
        className="text-sm"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onCancel}
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
          {label}
        </Button>
      </div>
    </div>
  );
}
