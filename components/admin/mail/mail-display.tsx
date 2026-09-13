"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArchiveX,
  ArrowLeft,
  File,
  Folder,
  FolderInput,
  Forward,
  MailOpen,
  MoreVertical,
  MousePointerClick,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { cn } from "@/lib/cn";
import type { MailFolder, SpecialUse } from "@/lib/mail/store/types";
import type { RenderedMessage } from "@/lib/services/mail.service";
import { seedFields, type ComposeMode } from "./compose-panel";
import { MailEditor } from "./mail-editor";
import {
  enc,
  fullDate,
  humanSize,
  initials,
  mailApi,
  personFull,
  personLabel,
} from "./mail-shared";
import { ShieldAlert } from "lucide-react";

/**
 * The reading pane: toolbar, sender header, body, attachments and a quick
 * reply. Every toolbar button is disabled until a message is open, like the
 * reference layout, so the pane keeps its shape.
 */
export type MoveTarget = "trash" | "archive" | "inbox" | "junk";

function ToolButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={className}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MailDisplay({
  address,
  folder,
  special,
  folders,
  hasArchive,
  hasJunk,
  message,
  loading,
  error,
  busy,
  allowImages,
  onAllowImages,
  onMove,
  onMoveTo,
  onFlag,
  onCompose,
  onSent,
  onBack,
}: {
  address: string;
  folder: string;
  special: SpecialUse;
  /** Every folder of the mailbox, for "Move to…". */
  folders: MailFolder[];
  hasArchive: boolean;
  hasJunk: boolean;
  message: RenderedMessage | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  allowImages: boolean;
  onAllowImages: () => void;
  onMove: (uid: number, to: MoveTarget) => void;
  onMoveTo: (uid: number, path: string) => void;
  onFlag: (uid: number, patch: { seen?: boolean; flagged?: boolean }) => void;
  onCompose: (mode: ComposeMode) => void;
  onSent: () => void;
  /** Present below `lg`, where the reader replaces the list. */
  onBack?: () => void;
}) {
  const msg = message;
  const inTrashOrJunk = special === "trash" || special === "junk";
  const files = msg?.attachments.filter((a) => !a.inline) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-2 p-2">
        {onBack && (
          <ToolButton label="Back to list" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
          </ToolButton>
        )}
        <div className="flex items-center gap-2">
          {inTrashOrJunk ? (
            <ToolButton
              label={special === "junk" ? "Not junk" : "Move to Inbox"}
              disabled={!msg || busy}
              onClick={() => msg && onMove(msg.uid, "inbox")}
            >
              <ArchiveRestore className="size-4" aria-hidden />
            </ToolButton>
          ) : (
            <ToolButton
              label="Archive"
              disabled={!msg || busy || !hasArchive || special === "archive"}
              onClick={() => msg && onMove(msg.uid, "archive")}
            >
              <Archive className="size-4" aria-hidden />
            </ToolButton>
          )}
          <ToolButton
            label="Move to junk"
            disabled={!msg || busy || !hasJunk || special === "junk"}
            onClick={() => msg && onMove(msg.uid, "junk")}
          >
            <ArchiveX className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton
            label="Move to trash"
            disabled={!msg || busy || special === "trash"}
            onClick={() => msg && onMove(msg.uid, "trash")}
          >
            <Trash2 className="size-4" aria-hidden />
          </ToolButton>
        </div>
        <Separator orientation="vertical" className="mx-1 h-6!" />
        <ToolButton
          label="Mark as unread"
          disabled={!msg}
          onClick={() => {
            if (!msg) return;
            onFlag(msg.uid, { seen: false });
            onBack?.();
          }}
        >
          <MailOpen className="size-4" aria-hidden />
        </ToolButton>
        <div className="ml-auto flex items-center gap-2">
          <ToolButton
            label="Reply"
            disabled={!msg}
            onClick={() => onCompose("reply")}
          >
            <Reply className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton
            label="Reply all"
            disabled={!msg}
            onClick={() => onCompose("replyAll")}
          >
            <ReplyAll className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton
            label="Forward"
            disabled={!msg}
            onClick={() => onCompose("forward")}
          >
            <Forward className="size-4" aria-hidden />
          </ToolButton>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6!" />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!msg}
              aria-label="More"
            >
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          {msg && (
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onFlag(msg.uid, { flagged: !msg.flagged })}
              >
                {msg.flagged ? "Remove star" : "Star message"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  onFlag(msg.uid, { seen: false });
                  onBack?.();
                }}
              >
                Mark as unread
              </DropdownMenuItem>
              {msg.blockedRemoteImages > 0 && !allowImages && (
                <DropdownMenuItem onSelect={onAllowImages}>
                  Load remote images
                </DropdownMenuItem>
              )}
              {!inTrashOrJunk && special !== "inbox" && (
                <DropdownMenuItem onSelect={() => onMove(msg.uid, "inbox")}>
                  Move to Inbox
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="size-4" aria-hidden />
                  Move to…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                  {folders
                    .filter((f) => f.path !== folder)
                    .map((f) => (
                      <DropdownMenuItem
                        key={f.path}
                        onSelect={() => onMoveTo(msg.uid, f.path)}
                      >
                        <Folder className="size-4" aria-hidden />
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
      <Separator />

      {loading ? (
        <div className="grid gap-3 p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="mt-4 h-40" />
        </div>
      ) : error ? (
        <EmptyState
          icon={ShieldAlert}
          title="Could not open this message"
          description={error}
          className="my-auto"
        />
      ) : msg ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start p-4">
            <div className="flex min-w-0 items-start gap-4 text-sm">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {initials(msg.from)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 gap-1">
                <div className="truncate font-semibold">
                  {personLabel(msg.from)}
                </div>
                <div className="line-clamp-1 text-xs">{msg.subject}</div>
                <div className="line-clamp-1 text-xs">
                  <span className="font-medium">Reply-To:</span>{" "}
                  {(msg.replyTo[0] ?? msg.from)?.address ?? "—"}
                </div>
                {msg.date && (
                  <time
                    className="text-muted-foreground text-xs sm:hidden"
                    dateTime={msg.date}
                  >
                    {fullDate(msg.date)}
                  </time>
                )}
                {(msg.to.length > 1 || msg.cc.length > 0) && (
                  <div className="text-muted-foreground line-clamp-1 text-xs">
                    <span className="font-medium">To:</span>{" "}
                    {msg.to.map(personFull).join(", ")}
                    {msg.cc.length > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium">Cc:</span>{" "}
                        {msg.cc.map(personFull).join(", ")}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {msg.date && (
              <time
                className="text-muted-foreground ml-auto hidden shrink-0 pl-3 text-xs sm:block"
                dateTime={msg.date}
              >
                {fullDate(msg.date)}
              </time>
            )}
          </div>
          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {msg.blockedRemoteImages > 0 && !allowImages && (
              <div className="bg-muted text-muted-foreground mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs">
                <span>
                  {msg.blockedRemoteImages} remote image
                  {msg.blockedRemoteImages === 1 ? "" : "s"} blocked for
                  privacy.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={onAllowImages}
                >
                  Load images
                </Button>
              </div>
            )}
            <div
              className="mail-body [&_a]:text-primary max-w-full overflow-x-auto p-4 text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_img]:h-auto [&_img]:max-w-full [&_p]:my-2 [&_table]:max-w-full"
              // Sanitised server-side (lib/mail/sanitize.ts); never raw.
              dangerouslySetInnerHTML={{ __html: msg.html }}
            />
            {files.length > 0 && (
              <div className="px-4 pb-4">
                <div className="text-muted-foreground mb-2 text-xs font-medium">
                  {files.length} attachment{files.length === 1 ? "" : "s"}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {files.map((a) => {
                    const url = `/api/admin/mail/${enc(address)}/messages/${msg.uid}/attachments/${a.index}?folder=${enc(folder)}`;
                    const isImage = a.contentType
                      .toLowerCase()
                      .startsWith("image/");
                    return (
                      <li key={a.index}>
                        <a
                          href={url}
                          className="hover:bg-accent flex items-center gap-2.5 rounded-lg border p-1.5 pr-3 transition-colors"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element -- streamed from our own gated route
                            <img
                              src={url}
                              alt=""
                              className="bg-muted size-9 rounded object-cover"
                            />
                          ) : (
                            <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded">
                              <File className="size-4" aria-hidden />
                            </span>
                          )}
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="max-w-[14rem] truncate text-xs font-medium">
                              {a.filename}
                            </span>
                            <span className="text-muted-foreground text-[0.625rem]">
                              {humanSize(a.size)}
                            </span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <Separator className="mt-auto" />
          <QuickReply
            key={`${folder}:${msg.uid}`}
            address={address}
            folder={folder}
            message={msg}
            onSent={onSent}
            onOpenComposer={() => onCompose("reply")}
          />
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <MousePointerClick className="size-6" aria-hidden />
          <p>No message selected</p>
        </div>
      )}
    </div>
  );
}

/** Reply in place, as a real reply (In-Reply-To, quoted original, filed in Sent). */
function QuickReply({
  address,
  folder,
  message,
  onSent,
  onOpenComposer,
}: {
  address: string;
  folder: string;
  message: RenderedMessage;
  onSent: () => void;
  onOpenComposer: () => void;
}) {
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  // A new editor after each send clears the box (TipTap owns its content).
  const [round, setRound] = useState(0);
  const [sending, setSending] = useState(false);
  const seed = seedFields(
    { mode: "reply", folder, original: message },
    address.toLowerCase(),
  );

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("to", seed.to);
      fd.set("cc", "");
      fd.set("bcc", "");
      fd.set("subject", seed.subject);
      fd.set("text", `${text.trim()}${seed.text}`);
      fd.set("html", `${html}${seed.html}`);
      fd.set("replyFolder", folder);
      fd.set("replyUid", String(message.uid));
      const data = await mailApi<{ filed?: boolean }>(
        `/api/admin/mail/${enc(address)}/send`,
        { method: "POST", body: fd },
      );
      toast.success(
        data.filed
          ? "Sent."
          : "Sent — but the copy could not be filed in Sent.",
      );
      setText("");
      setHtml("");
      setRound((r) => r + 1);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="grid gap-4">
          <MailEditor
            key={round}
            placeholder={`Reply ${personLabel(message.from)}…`}
            minHeight="4rem"
            onChange={(h, t) => {
              setHtml(h);
              setText(t);
            }}
            onSubmit={() => void send()}
            disabled={sending}
          />
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("text-muted-foreground -ml-2")}
              onClick={onOpenComposer}
            >
              Open full composer
            </Button>
            <Button
              type="submit"
              size="sm"
              className="ml-auto"
              disabled={sending || !text.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
