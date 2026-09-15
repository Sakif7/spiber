"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor } from "@tiptap/react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/admin/ui/select-field";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { documentExtensions } from "@/lib/documents/extensions";
import { columnMetrics, type ChromeCompany } from "@/lib/documents/chrome";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  PAGE,
} from "@/lib/documents/types";
import type {
  ReviewDesk,
  ReviewState,
} from "@/lib/services/documents/document-review.service";
import { PageStack, ZOOMS } from "./page-stack";
import { CommentAnchors } from "./comment-anchors";
import { CommentBubble } from "./comment-bubble";
import { CommentsPanel, postJson } from "./comments-panel";
import { usePager } from "./use-pager";
import "./fonts.css";

/**
 * The reviewer's desk: the draft exactly as the author sees it, read-only,
 * with the comment threads beside it. Select words, press "Comment"; say
 * "Finish review" when done. A sent document still opens here, with its
 * threads, but takes no more comments.
 */
export function DocumentReview({
  desk,
  company,
  logoSrc,
}: {
  desk: ReviewDesk;
  company: ChromeCompany;
  logoSrc: string;
}) {
  const [zoom, setZoom] = useState("fit");
  const [review, setReview] = useState<ReviewState>(desk.state);
  const [finishing, setFinishing] = useState(false);
  const me =
    review.reviewers.find((r) => r.userId === desk.me?.userId) ?? desk.me;
  const open = review.status === "draft" || review.status === "in_review";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...documentExtensions(), CommentAnchors],
    content: desk.body,
    editable: false,
    editorProps: {
      attributes: { class: "doc-column doc-text", spellcheck: "false" },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setMergeValues(desk.mergeValues);
  }, [editor, desk.mergeValues]);

  const metrics = useMemo(() => {
    const m = columnMetrics(desk.settings);
    return {
      pageHeight: PAGE.height,
      contentTop: m.top,
      contentBottom: m.bottom,
      gap: PAGE.screenGap,
    };
  }, [desk.settings]);
  const pager = usePager(editor, metrics, ".doc-pages .doc-column");
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setTocPages(pager.pageOfBlock);
  }, [editor, pager.pageOfBlock]);
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
      settings: desk.settings,
      company,
      number: desk.number,
      title: desk.title || "Untitled",
      logoSrc,
    }),
    [desk.settings, company, desk.number, desk.title, logoSrc],
  );

  const commentApi = useMemo(() => {
    const base = `/api/admin/me/reviews/${desk.id}/comments`;
    return { list: base, add: base, reply: (c: string) => `${base}/${c}` };
  }, [desk.id]);

  async function commentOnText(input: {
    quote: string;
    prefix: string;
    suffix: string;
    at: number;
    text: string;
  }) {
    const res = await postJson<ReviewState>(commentApi.add, input);
    if (!res.ok) {
      toast.error(
        res.code === "locked"
          ? "This document has been sent; the review is over."
          : res.message,
      );
      return false;
    }
    setReview(res.data);
    const added = res.data.comments[res.data.comments.length - 1];
    if (added) editor?.commands.setCurrentComment(added.id);
    return true;
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await postJson<ReviewState>(
        `/api/admin/me/reviews/${desk.id}/done`,
        {},
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setReview(res.data);
      toast.success("Thank you — the author has been told.");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="bg-card text-card-foreground flex h-[calc(100dvh-6rem)] min-h-[32rem] flex-col overflow-hidden rounded-md border">
      <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Back to reviews"
        >
          <Link href="/admin/me/reviews">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="truncate text-base font-semibold">{desk.title}</h1>
          <span className="text-muted-foreground hidden shrink-0 items-center gap-2 text-xs sm:flex">
            <span>{DOCUMENT_TYPE_LABEL[desk.type]}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{desk.number ?? "No number yet"}</span>
          </span>
          <StatusBadge tone={statusTone(review.status)}>
            {DOCUMENT_STATUS_LABEL[review.status]}
          </StatusBadge>
        </div>
        <div className="flex items-center gap-2">
          <SelectField
            ariaLabel="Zoom"
            value={zoom}
            onChange={setZoom}
            options={ZOOMS}
            className="h-8 w-20 text-xs"
          />
          {open && me?.status === "pending" && (
            <Button
              type="button"
              size="sm"
              disabled={finishing}
              onClick={() => void finish()}
            >
              {finishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CheckCheck className="size-4" aria-hidden />
              )}
              Finish review
            </Button>
          )}
          {open && me?.status === "done" && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <CheckCheck className="size-3.5" aria-hidden />
              You finished your review
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <PageStack
          editor={editor}
          pager={pager}
          contentBottom={metrics.contentBottom}
          chrome={chrome}
          zoom={zoom}
        >
          <CommentBubble
            editor={editor}
            enabled={open}
            onSubmit={commentOnText}
          />
        </PageStack>
        <aside className="border-border flex max-h-[45%] shrink-0 flex-col border-t lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l">
          <div className="text-muted-foreground border-border border-b px-3 py-2 text-xs font-medium tracking-wide uppercase">
            Comments
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
            {!open && (
              <p className="text-muted-foreground mb-3 text-xs">
                This document has been sent; the review is closed.
              </p>
            )}
            <CommentsPanel
              editor={editor}
              state={review}
              onState={setReview}
              endpoints={commentApi}
              canResolve={false}
              open={open}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
