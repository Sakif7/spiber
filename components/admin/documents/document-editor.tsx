"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  Check,
  CloudOff,
  FileDown,
  FileText,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SelectField } from "@/components/admin/ui/select-field";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import {
  ConfirmDialog,
  NameDialog,
} from "@/components/admin/company/file-manager/dialogs";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import { formatApiError } from "@/lib/http/form-error";
import { documentExtensions } from "@/lib/documents/extensions";
import { columnMetrics, type ChromeCompany } from "@/lib/documents/chrome";
import {
  DOCUMENT_FONTS,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  FONT_SIZES,
  PAGE,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/documents/types";
import type { ReviewState } from "@/lib/services/documents/document-review.service";
import {
  documentSettingsSchema,
  type DocumentBody,
  type DocumentSettings,
} from "@/lib/schemas/authored-document";
import { EditorToolbar } from "./editor-toolbar";
import { SendDialog } from "./send-dialog";
import { ReissueButton } from "./reissue-button";
import { SearchReplace } from "./search-replace";
import { FindBar } from "./find-bar";
import { FootnotePopover } from "./footnotes";
import { PageStack, ZOOMS } from "./page-stack";
import { CommentAnchors } from "./comment-anchors";
import { CommentBubble } from "./comment-bubble";
import { CommentsPanel, postJson } from "./comments-panel";
import { ReviewDialog } from "./review-dialog";
import { slotsIn, type SlotRef } from "@/lib/documents/slots";
import { mergeValues } from "@/lib/documents/merge";
import { useEmployees } from "./people-picker";
import "./fonts.css";
import { usePager } from "./use-pager";
import { useEditorStat } from "./use-editor-stat";

/**
 * The writing desk: title bar, ribbon, the A4 pages with the company chrome,
 * and a rail with the outline, the filed versions and the page settings.
 * The text autosaves a second and a half after the last keystroke, with the
 * document's revision so a second tab can never overwrite this one.
 */
export type EditorDocument = {
  id: string;
  type: DocumentType;
  number: string | null;
  title: string;
  status: DocumentStatus;
  body: DocumentBody;
  rev: number;
  settings: DocumentSettings;
  versions: {
    n: number;
    label: string;
    note: string | null;
    pages: number | null;
    createdAt: string;
  }[];
  /** Recipients of the current round who have not acted (sent documents). */
  pendingRecipients?: number;
  /** Whose details fill the merge fields. */
  mergeEmployeeId: string | null;
  /** The review: who was asked, and the threads. */
  review: ReviewState;
};

type SaveState = "saved" | "dirty" | "saving" | "stale" | "error";
const AUTOSAVE_MS = 1500;

async function api<T>(
  url: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string }
> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    return {
      ok: false,
      status: res.status,
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

export function DocumentEditor({
  document: initial,
  company,
  logoSrc,
}: {
  document: EditorDocument;
  company: ChromeCompany;
  logoSrc: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [settings, setSettings] = useState<DocumentSettings>(() =>
    documentSettingsSchema.parse(initial.settings ?? {}),
  );
  const [versions, setVersions] = useState(initial.versions);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [zoom, setZoom] = useState("fit");
  const [rail, setRail] = useState<
    "outline" | "comments" | "versions" | "settings"
  >("outline");
  const [status, setStatus] = useState(initial.status);
  const [review, setReview] = useState<ReviewState>(initial.review);
  const [askReview, setAskReview] = useState(false);
  const [asking, setAsking] = useState(false);
  const [filing, setFiling] = useState(false);
  const [askNote, setAskNote] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askSend, setAskSend] = useState(false);
  const [find, setFind] = useState<null | { replace: boolean }>(null);
  const [sending, setSending] = useState(false);
  const [sendSlots, setSendSlots] = useState<SlotRef[]>([]);
  const revRef = useRef(initial.rev);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{
    body?: DocumentBody;
    title?: string;
    settings?: Partial<DocumentSettings>;
    mergeEmployeeId?: string | null;
  }>({});
  const [mergeEmployeeId, setMergeEmployeeId] = useState(
    initial.mergeEmployeeId,
  );
  const people = useEmployees(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...documentExtensions(),
      Placeholder.configure({ placeholder: "Start writing…" }),
      SearchReplace,
      CommentAnchors,
    ],
    content: initial.body,
    editable: initial.status === "draft" || initial.status === "in_review",
    editorProps: {
      attributes: { class: "doc-column doc-text", spellcheck: "true" },
    },
    onUpdate: ({ editor: e }) => {
      pending.current.body = e.getJSON() as DocumentBody;
      setSaveState((s) => (s === "stale" ? s : "dirty"));
      schedule();
    },
  });

  // ── autosave ─────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    const patch = pending.current;
    if (
      !patch.body &&
      patch.title === undefined &&
      !patch.settings &&
      patch.mergeEmployeeId === undefined
    )
      return;
    pending.current = {};
    setSaveState("saving");
    const res = await api<{ rev: number; updatedAt: string }>(
      `/api/admin/company/documents/${initial.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...patch, rev: revRef.current }),
      },
    );
    if (!res.ok) {
      if (res.code === "stale") {
        setSaveState("stale");
        toast.error(
          "This document was changed in another tab. Reload to keep working.",
        );
      } else if (res.code === "locked") {
        setSaveState("stale");
        toast.error("This document has been sent and can no longer be edited.");
      } else {
        // Keep the unsaved edits for the next try.
        pending.current = { ...patch, ...pending.current };
        setSaveState("error");
        toast.error(res.message);
      }
      return;
    }
    revRef.current = res.data.rev;
    setSavedAt(new Date(res.data.updatedAt));
    setSaveState(
      pending.current.body ||
        pending.current.title !== undefined ||
        pending.current.settings ||
        pending.current.mergeEmployeeId !== undefined
        ? "dirty"
        : "saved",
    );
  }, [initial.id]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useUnsavedGuard(
    saveState === "dirty" || saveState === "saving" || saveState === "error",
    flush,
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void flush();
      }
      // Find (Ctrl+F) and replace (Ctrl+H) — the document's, not the page's.
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h") &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setFind({ replace: e.key.toLowerCase() === "h" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  function changeTitle(v: string) {
    setTitle(v);
    pending.current.title = v;
    setSaveState((s) => (s === "stale" ? s : "dirty"));
    schedule();
  }
  // The merge fields' values, redrawn whenever the addressee, the title or
  // the people list changes — on screen only; the printer works them out.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const person = people.people.find((p) => p.id === mergeEmployeeId) ?? null;
    const values = mergeValues({
      employee: person
        ? {
            name: person.name,
            designation: person.designation,
            code: person.code,
            businessEmail: person.businessEmail,
            email: person.email,
            phone: person.phone,
            joinedAt: person.joinedAt,
            kind: person.kind,
          }
        : null,
      company,
      document: { number: initial.number, title, date: new Date() },
    });
    editor.commands.setMergeValues(values as Record<string, string>);
  }, [editor, people.people, mergeEmployeeId, company, initial.number, title]);

  function changeAddressee(id: string | null) {
    setMergeEmployeeId(id);
    pending.current.mergeEmployeeId = id;
    setSaveState((s) => (s === "stale" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    void flush();
  }

  function changeSettings(patch: Partial<DocumentSettings>) {
    const next = documentSettingsSchema.parse({ ...settings, ...patch });
    setSettings(next);
    pending.current.settings = {
      ...(pending.current.settings ?? {}),
      ...patch,
    };
    setSaveState((s) => (s === "stale" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    void flush();
  }

  // ── pages ────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const m = columnMetrics(settings);
    return {
      pageHeight: PAGE.height,
      contentTop: m.top,
      contentBottom: m.bottom,
      gap: PAGE.screenGap,
    };
  }, [settings]);
  const pager = usePager(editor, metrics, ".doc-pages .doc-column");
  // The table of contents takes its page numbers from the pager.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setTocPages(pager.pageOfBlock);
  }, [editor, pager.pageOfBlock]);
  // The comment highlights follow the threads.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setCommentThreads(
      review.comments.map((c) => ({
        id: c.id,
        quote: c.quote,
        prefix: c.prefix,
        suffix: c.suffix,
        at: c.at,
        resolved: Boolean(c.resolvedAt),
      })),
    );
  }, [editor, review.comments]);

  const chrome = useMemo(
    () => ({
      settings,
      company,
      number: initial.number,
      title: title || "Untitled",
      logoSrc,
    }),
    [settings, company, initial.number, title, logoSrc],
  );

  // ── outline ──────────────────────────────────────────────────────────
  const outline = useEditorStat(
    editor,
    (e) => {
      const items: { pos: number; level: number; text: string }[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading")
          items.push({
            pos,
            level: node.attrs.level as number,
            text: node.textContent,
          });
        return node.type.name !== "heading";
      });
      return items;
    },
    EMPTY_OUTLINE,
    (a, b) =>
      a.length === b.length &&
      a.every(
        (x, i) =>
          x.pos === b[i].pos && x.level === b[i].level && x.text === b[i].text,
      ),
  );
  const words = useEditorStat(
    editor,
    (e) =>
      e.state.doc
        .textBetween(0, e.state.doc.content.size, " ")
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  );

  // ── versions ─────────────────────────────────────────────────────────
  function openSend() {
    if (!editor) return;
    setSendSlots(slotsIn(editor.getJSON() as DocumentBody));
    setAskSend(true);
  }

  async function sendNow(input: { acknowledgers: string[]; message: string }) {
    setSending(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      const res = await api<{
        number: string;
        status: "sent" | "completed";
        recipients: { name: string }[];
      }>(`/api/admin/company/documents/${initial.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          acknowledgers: input.acknowledgers,
          message: input.message || undefined,
        }),
      });
      if (!res.ok) {
        toast.error(
          res.code === "print_failed"
            ? "The PDF could not be rendered — is the printer configured on this server?"
            : res.message,
        );
        return;
      }
      setAskSend(false);
      toast.success(
        res.data.recipients.length
          ? `Sent as ${res.data.number} to ${res.data.recipients.map((r) => r.name).join(", ")}.`
          : `Filed as ${res.data.number}.`,
      );
      router.push(`/admin/company/documents/${initial.id}`);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function fileVersionNow(note: string) {
    setAskNote(false);
    setFiling(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      const res = await api<{ version: number; pages: number }>(
        `/api/admin/company/documents/${initial.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({ note: note || undefined }),
        },
      );
      if (!res.ok) {
        toast.error(
          res.code === "print_failed"
            ? "The PDF could not be rendered — is the printer configured on this server?"
            : res.message,
        );
        return;
      }
      toast.success(
        `Version ${res.data.version} filed in the vault (${res.data.pages} page${res.data.pages === 1 ? "" : "s"}).`,
      );
      setVersions((v) => [
        ...v,
        {
          n: res.data.version,
          label: "snapshot",
          note: note || null,
          pages: res.data.pages,
          createdAt: new Date().toISOString(),
        },
      ]);
      setRail("versions");
    } finally {
      setFiling(false);
    }
  }
  async function deleteDraft() {
    setAskDelete(false);
    const res = await api(`/api/admin/company/documents/${initial.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Draft deleted.");
    router.push("/admin/company/documents");
  }

  // ── review ───────────────────────────────────────────────────────────
  const commentApi = useMemo(() => {
    const base = `/api/admin/company/documents/${initial.id}/comments`;
    return {
      list: base,
      add: base,
      reply: (c: string) => `${base}/${c}`,
      resolve: (c: string) => `${base}/${c}`,
    };
  }, [initial.id]);

  async function askForReview(input: { reviewers: string[]; message: string }) {
    setAsking(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      const res = await postJson<ReviewState>(
        `/api/admin/company/documents/${initial.id}/review`,
        { reviewers: input.reviewers, message: input.message || undefined },
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setReview(res.data);
      setStatus(res.data.status);
      setAskReview(false);
      setRail("comments");
      toast.success(
        `Asked ${res.data.reviewers.filter((r) => r.status === "pending").length} to review.`,
      );
    } finally {
      setAsking(false);
    }
  }

  async function commentOnText(input: {
    quote: string;
    prefix: string;
    suffix: string;
    at: number;
    text: string;
  }) {
    const res = await postJson<ReviewState>(commentApi.add, input);
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    setReview(res.data);
    setRail("comments");
    const added = res.data.comments[res.data.comments.length - 1];
    if (added) editor?.commands.setCurrentComment(added.id);
    return true;
  }
  const openComments = review.comments.filter((c) => !c.resolvedAt).length;

  const editable = status === "draft" || status === "in_review";
  const font =
    DOCUMENT_FONTS.find((f) => f.id === settings.font) ?? DOCUMENT_FONTS[0];

  return (
    <div className="bg-card text-card-foreground flex h-[calc(100dvh-6rem)] min-h-[32rem] flex-col overflow-hidden rounded-md border">
      {/* ── title bar ── */}
      <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Back to documents"
        >
          <Link href="/admin/company/documents">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Input
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
            aria-label="Document title"
            disabled={!editable}
            className="focus-visible:border-input h-8 max-w-md border-transparent px-2 text-base font-semibold shadow-none"
          />
          <span className="text-muted-foreground hidden shrink-0 items-center gap-2 text-xs sm:flex">
            <span>{DOCUMENT_TYPE_LABEL[initial.type]}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">
              {initial.number ?? "No number yet"}
            </span>
          </span>
          <StatusBadge tone={statusTone(status)}>
            {DOCUMENT_STATUS_LABEL[status]}
          </StatusBadge>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-muted-foreground flex items-center gap-1 text-xs"
            aria-live="polite"
          >
            {saveState === "saving" && (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            )}
            {saveState === "saved" && <Check className="size-3" aria-hidden />}
            {(saveState === "error" || saveState === "stale") && (
              <CloudOff className="text-destructive size-3" aria-hidden />
            )}
            {saveState === "saved"
              ? savedAt
                ? `Saved ${when(savedAt.toISOString())}`
                : "Saved"
              : saveState === "dirty"
                ? "Unsaved changes"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "stale"
                    ? "Reload to continue"
                    : "Not saved"}
          </span>
          <SelectField
            ariaLabel="Zoom"
            value={zoom}
            onChange={setZoom}
            options={ZOOMS}
            className="h-8 w-20 text-xs"
          />
          <Button asChild type="button" variant="outline" size="sm">
            <a
              href={`/api/admin/company/documents/${initial.id}/pdf`}
              target="_blank"
              rel="noopener"
            >
              <FileText className="size-4" aria-hidden />
              Preview PDF
            </a>
          </Button>
          <Button
            type="button"
            variant={editable ? "outline" : "default"}
            size="sm"
            disabled={filing || saveState === "stale"}
            onClick={() => setAskNote(true)}
          >
            {filing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="size-4" aria-hidden />
            )}
            File version
          </Button>
          {editable && (
            <Button
              type="button"
              size="sm"
              disabled={sending || saveState === "stale" || !editor}
              onClick={openSend}
            >
              <Send className="size-4" aria-hidden />
              Send…
            </Button>
          )}
          {(status === "sent" || status === "completed") && (
            <ReissueButton
              documentId={initial.id}
              number={initial.number}
              pending={initial.pendingRecipients ?? 0}
            />
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="More"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!editable}
                onSelect={() => setAskReview(true)}
              >
                <MessageSquareText className="size-4" />
                Ask for a review…
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/admin/company/documents/${initial.id}/pdf?download=1`}
                >
                  Download PDF
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/admin/company/documents/${initial.id}/docx`}>
                  Download Word (.docx)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!editable}
                onSelect={() => setAskDelete(true)}
              >
                <Trash2 className="size-4" />
                Delete draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {editor && editable && (
        <EditorToolbar
          editor={editor}
          defaultFontId={settings.font}
          defaultSize={settings.fontSize}
          onSaveVersion={() => setAskNote(true)}
          onFind={() => setFind({ replace: false })}
        />
      )}
      {editor && find && (
        <FindBar
          editor={editor}
          focusReplace={find.replace}
          onClose={() => setFind(null)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        {/* ── pages ── */}
        <PageStack
          editor={editor}
          pager={pager}
          contentBottom={metrics.contentBottom}
          chrome={chrome}
          zoom={zoom}
        >
          {editable && <FootnotePopover editor={editor} />}
          <CommentBubble
            editor={editor}
            enabled={editable && !find}
            onSubmit={commentOnText}
          />
        </PageStack>

        {/* ── rail ── */}
        <aside className="border-border hidden w-72 shrink-0 flex-col border-l lg:flex">
          <Tabs
            value={rail}
            onValueChange={(v) => setRail(v as typeof rail)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList className="m-2 grid grid-cols-4">
              <TabsTrigger value="outline">Outline</TabsTrigger>
              <TabsTrigger value="comments">
                Notes
                {openComments > 0 && (
                  <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-[10px] leading-4">
                    {openComments}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="settings">Page</TabsTrigger>
            </TabsList>
            <Separator />
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
              {rail === "outline" &&
                (outline.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Headings you add appear here; click one to jump to it.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {outline.map((h) => (
                      <li key={h.pos}>
                        <button
                          type="button"
                          className="hover:bg-accent w-full truncate rounded px-2 py-1 text-left"
                          style={{
                            paddingLeft: 8 + (h.level - 1) * 12,
                            fontSize: h.level === 1 ? 14 : 13,
                          }}
                          onClick={() =>
                            editor
                              ?.chain()
                              .focus(h.pos + 1)
                              .scrollIntoView()
                              .run()
                          }
                        >
                          {h.text || "(untitled heading)"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
              {rail === "comments" && (
                <CommentsPanel
                  editor={editor}
                  state={review}
                  onState={setReview}
                  endpoints={commentApi}
                  canResolve
                  open={editable}
                  header={
                    <div className="space-y-2">
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={!editable}
                        onClick={() => setAskReview(true)}
                      >
                        <MessageSquareText className="size-4" aria-hidden />
                        Ask for a review…
                      </Button>
                      {review.reviewers.length > 0 && (
                        <ul className="divide-y rounded-md border text-xs">
                          {review.reviewers.map((r) => (
                            <li
                              key={r.userId}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                            >
                              <span className="truncate">{r.name}</span>
                              <StatusBadge
                                tone={
                                  r.status === "done" ? "success" : "warning"
                                }
                                dot={false}
                              >
                                {r.status === "done" ? "reviewed" : "asked"}
                              </StatusBadge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  }
                />
              )}
              {rail === "versions" &&
                (versions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Nothing filed yet. “File version” renders the PDF and stores
                    it in the vault; sending will do the same automatically.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {[...versions].reverse().map((v) => (
                      <li key={v.n} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Version {v.n}</span>
                          <StatusBadge
                            tone={
                              v.label === "sent" || v.label === "completed"
                                ? "success"
                                : "neutral"
                            }
                            dot={false}
                          >
                            {v.label}
                          </StatusBadge>
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {when(v.createdAt)}
                          {v.pages
                            ? ` · ${v.pages} page${v.pages === 1 ? "" : "s"}`
                            : ""}
                        </div>
                        {v.note && <div className="mt-1 text-xs">{v.note}</div>}
                        <a
                          href={`/api/admin/company/documents/${initial.id}/versions/${v.n}`}
                          target="_blank"
                          rel="noopener"
                          className="text-primary mt-1.5 inline-block text-xs font-medium hover:underline"
                        >
                          Open PDF
                        </a>
                      </li>
                    ))}
                  </ul>
                ))}
              {rail === "settings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="s-letterhead">Company letterhead</Label>
                    <Switch
                      id="s-letterhead"
                      checked={settings.letterhead}
                      disabled={!editable}
                      onCheckedChange={(v) => changeSettings({ letterhead: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="s-pages">Page numbers</Label>
                    <Switch
                      id="s-pages"
                      checked={settings.pageNumbers}
                      disabled={!editable}
                      onCheckedChange={(v) =>
                        changeSettings({ pageNumbers: v })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-header">Header line</Label>
                    <Input
                      id="s-header"
                      value={settings.header}
                      disabled={!editable}
                      placeholder="e.g. Internal — do not forward"
                      onChange={(e) =>
                        setSettings({ ...settings, header: e.target.value })
                      }
                      onBlur={(e) => changeSettings({ header: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-footer">Footer line</Label>
                    <Input
                      id="s-footer"
                      value={settings.footer}
                      disabled={!editable}
                      onChange={(e) =>
                        setSettings({ ...settings, footer: e.target.value })
                      }
                      onBlur={(e) => changeSettings({ footer: e.target.value })}
                    />
                    <p className="text-muted-foreground text-xs">
                      {"{{number}}"} and {"{{title}}"} are filled in.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Addressed to</Label>
                    <SelectField
                      value={mergeEmployeeId ?? "none"}
                      disabled={!editable}
                      onChange={(v) => changeAddressee(v === "none" ? null : v)}
                      options={[
                        { value: "none", label: "No one in particular" },
                        ...people.people.map((p) => ({
                          value: p.id,
                          label: `${p.name} — ${p.designation}`,
                        })),
                      ]}
                    />
                    <p className="text-muted-foreground text-xs">
                      Fills the merge fields (Insert → Merge field): name,
                      designation, joining date and so on.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body font</Label>
                    <SelectField
                      value={settings.font}
                      disabled={!editable}
                      onChange={(v) => changeSettings({ font: v })}
                      options={DOCUMENT_FONTS.map((f) => ({
                        value: f.id,
                        label: f.label,
                      }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body size (pt)</Label>
                    <SelectField
                      value={String(settings.fontSize)}
                      disabled={!editable}
                      onChange={(v) => changeSettings({ fontSize: Number(v) })}
                      options={FONT_SIZES.map((n) => ({
                        value: String(n),
                        label: String(n),
                      }))}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Default: {font.label} {settings.fontSize} pt. Text you style
                    in the ribbon keeps its own font.
                  </p>
                </div>
              )}
            </div>
            <Separator />
            <div className="text-muted-foreground flex items-center justify-between px-3 py-1.5 text-xs">
              <span>
                {pager.pages} page{pager.pages === 1 ? "" : "s"}
              </span>
              <span>
                {words} word{words === 1 ? "" : "s"}
              </span>
            </div>
          </Tabs>
        </aside>
      </div>

      <NameDialog
        open={askNote}
        title="File a version"
        label="Note (optional)"
        confirmLabel="File version"
        busy={filing}
        onCancel={() => setAskNote(false)}
        onConfirm={(v) => void fileVersionNow(v)}
        allowEmpty
      />
      <ReviewDialog
        open={askReview}
        reviewers={review.reviewers}
        busy={asking}
        onCancel={() => setAskReview(false)}
        onAsk={(input) => void askForReview(input)}
      />
      <SendDialog
        open={askSend}
        slots={sendSlots}
        typeLabel={DOCUMENT_TYPE_LABEL[initial.type]}
        busy={sending}
        onCancel={() => setAskSend(false)}
        onSend={(input) => void sendNow(input)}
      />
      <ConfirmDialog
        open={askDelete}
        title="Delete this draft?"
        body="The draft and its filed versions stay in the vault's history, but the document disappears from the list."
        confirmLabel="Delete draft"
        destructive
        onCancel={() => setAskDelete(false)}
        onConfirm={() => void deleteDraft()}
      />
    </div>
  );
}

const EMPTY_OUTLINE: { pos: number; level: number; text: string }[] = [];
