"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  AtSign,
  Ban,
  ChevronLeft,
  ChevronRight,
  File,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  PenLine,
  Search,
  Send,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/admin/ui/select-field";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { ComposePanel, type ComposeSeed } from "./compose-panel";
import { cn } from "@/lib/cn";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type {
  ListResult,
  MailFolder,
  MailListItem,
} from "@/lib/mail/store/types";
import type { RenderedMessage } from "@/lib/services/mail.service";
import type { AccessibleMailbox } from "@/lib/services/mail.service";

/**
 * The mailbox: switcher → folders → list → reading pane. Everything comes
 * from `/api/admin/mail/*` through react-query, keyed by address + folder so
 * switching back is instant and a flag change updates the list in place.
 */
const PAGE_SIZE = 25;

type Json<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as Json<T> | null;
  if (!res.ok || !json?.ok || json.data === undefined) {
    const code = json?.error?.code ?? `http_${res.status}`;
    throw new Error(
      code === "mail_not_configured"
        ? "The mail server is not configured on this deployment."
        : code === "mail_auth_failed"
          ? "The mail server refused the app's master login."
          : code === "mail_unavailable"
            ? "The mail server could not be reached."
            : json?.error?.message || code,
    );
  }
  return json.data;
}

const enc = encodeURIComponent;

const FOLDER_ICON: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  archive: Archive,
  junk: Ban,
  trash: Trash2,
};

function when(iso: string | null, long = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (long) {
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const personLabel = (a: { name: string | null; address: string } | null) =>
  a ? a.name || a.address : "—";

const humanSize = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`;

export function MailClient({
  mailboxes,
  initialAddress,
}: {
  mailboxes: AccessibleMailbox[];
  initialAddress: string;
}) {
  const qc = useQueryClient();
  const [address, setAddress] = useState(initialAddress);
  const [folder, setFolder] = useState("INBOX");
  const [page, setPage] = useState(1);
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [allowImages, setAllowImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState<ComposeSeed | null>(null);
  const current = mailboxes.find((m) => m.address === address) ?? mailboxes[0];

  const applyQuery = useDebouncedCallback((q: string) => {
    setQuery(q);
    setPage(1);
    setSelected(null);
  }, 350);

  const folders = useQuery({
    queryKey: ["mail", address, "folders"],
    queryFn: () =>
      api<{ folders: MailFolder[] }>(
        `/api/admin/mail/${enc(address)}/folders`,
      ).then((d) => d.folders),
    staleTime: 30_000,
  });

  const listKey = ["mail", address, "list", folder, page, query] as const;
  const list = useQuery({
    queryKey: listKey,
    queryFn: () =>
      api<ListResult>(
        `/api/admin/mail/${enc(address)}/messages?folder=${enc(folder)}&page=${page}&pageSize=${PAGE_SIZE}${query ? `&q=${enc(query)}` : ""}`,
      ),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const message = useQuery({
    queryKey: ["mail", address, "message", folder, selected, allowImages],
    queryFn: () =>
      api<{ message: RenderedMessage }>(
        `/api/admin/mail/${enc(address)}/messages/${selected}?folder=${enc(folder)}${allowImages ? "&images=1" : ""}`,
      ).then((d) => d.message),
    enabled: selected !== null,
    staleTime: 60_000,
  });

  // Opening marks read on the server; reflect it in the list without a refetch.
  const patchListItem = (uid: number, patch: Partial<MailListItem>) => {
    qc.setQueryData<ListResult>(listKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((i) =>
              i.uid === uid ? { ...i, ...patch } : i,
            ),
          }
        : old,
    );
  };
  const openedUid = message.data?.seen ? message.data.uid : null;
  useEffect(() => {
    if (openedUid === null) return;
    // A query-cache write, not component state: safe in an effect.
    qc.setQueryData<ListResult>(listKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((i) =>
              i.uid === openedUid && !i.seen ? { ...i, seen: true } : i,
            ),
          }
        : old,
    );
    qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listKey is derived from the same state
  }, [openedUid]);

  function switchMailbox(next: string) {
    setAddress(next);
    setFolder("INBOX");
    setPage(1);
    setSelected(null);
    setQueryText("");
    setQuery("");
  }
  function switchFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelected(null);
  }

  async function toggleFlag(item: MailListItem) {
    const flagged = !item.flagged;
    patchListItem(item.uid, { flagged });
    try {
      await api(`/api/admin/mail/${enc(address)}/messages/${item.uid}/flags`, {
        method: "POST",
        body: JSON.stringify({ folder, flagged }),
      });
      qc.invalidateQueries({
        queryKey: ["mail", address, "message", folder, item.uid],
      });
    } catch (e) {
      patchListItem(item.uid, { flagged: !flagged });
      toast.error(
        e instanceof Error ? e.message : "Could not update the flag.",
      );
    }
  }

  async function markUnread(uid: number) {
    try {
      await api(`/api/admin/mail/${enc(address)}/messages/${uid}/flags`, {
        method: "POST",
        body: JSON.stringify({ folder, seen: false }),
      });
      patchListItem(uid, { seen: false });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as unread.");
    }
  }

  async function move(uid: number, to: "trash" | "archive" | "inbox" | "junk") {
    setBusy(true);
    try {
      await api(`/api/admin/mail/${enc(address)}/messages/${uid}/move`, {
        method: "POST",
        body: JSON.stringify({ folder, to }),
      });
      toast.success(
        to === "trash"
          ? "Moved to Trash."
          : to === "archive"
            ? "Archived."
            : to === "junk"
              ? "Marked as junk."
              : "Moved to Inbox.",
      );
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["mail", address, "list", folder] });
      qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
    } catch (e) {
      toast.error(
        e instanceof Error && /no_folder/.test(e.message)
          ? "This mailbox has no such folder."
          : e instanceof Error
            ? e.message
            : "Could not move the message.",
      );
    } finally {
      setBusy(false);
    }
  }

  const folderList = folders.data ?? [];
  const currentFolder = folderList.find((f) => f.path === folder);
  const hasArchive = folderList.some((f) => f.specialUse === "archive");
  const inTrash = currentFolder?.specialUse === "trash";
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const msg = message.data;

  return (
    <div className="grid gap-4">
      {/* Mailbox switcher row — same controls as every list toolbar. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AtSign
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <SelectField
            value={address}
            onChange={switchMailbox}
            options={mailboxes.map((m) => ({
              value: m.address,
              label: m.own
                ? `${m.address} · mine`
                : m.kind === "shared"
                  ? `${m.address} · shared`
                  : m.address,
            }))}
            className="w-[min(20rem,80vw)]"
          />
        </div>
        {current?.elevated && (
          <StatusBadge tone="warning">
            Opened as super admin · audited
          </StatusBadge>
        )}
        {current?.status === "disabled" && (
          <StatusBadge tone="neutral">Mailbox login disabled</StatusBadge>
        )}
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          onClick={() => setCompose({ mode: "new", folder, original: null })}
        >
          <PenLine className="size-4" aria-hidden />
          Compose
        </Button>
      </div>

      <div className="bg-card text-card-foreground grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-md border lg:grid-cols-[12.5rem_minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[12.5rem_minmax(0,24rem)_minmax(0,1fr)]">
        {/* Folders */}
        <nav
          aria-label="Folders"
          className="border-border flex flex-col gap-3 border-b p-2 lg:border-r lg:border-b-0"
        >
          {folders.isLoading ? (
            <div className="grid gap-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-7" />
              ))}
            </div>
          ) : folders.isError ? (
            <p className="text-destructive p-2 text-xs">
              {(folders.error as Error).message}
            </p>
          ) : (
            <ul className="flex flex-row flex-wrap gap-0.5 lg:flex-col">
              {folderList.map((f) => {
                const Icon =
                  (f.specialUse && FOLDER_ICON[f.specialUse]) || File;
                const active = f.path === folder;
                return (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => switchFolder(f.path)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {f.unseen > 0 && (
                        <span className="font-mono text-[0.6875rem]">
                          {f.unseen}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* Message list */}
        <section
          aria-label="Messages"
          className="border-border flex min-h-0 flex-col border-b lg:border-r lg:border-b-0"
        >
          <div className="border-border flex items-center gap-2 border-b p-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  applyQuery(e.target.value);
                }}
                placeholder={`Search ${currentFolder?.name ?? "folder"}`}
                aria-label="Search messages"
                className="h-8 pl-8"
              />
            </div>
          </div>
          <div className="text-muted-foreground border-border flex items-center justify-between border-b px-3 py-1.5 text-xs">
            <span>
              {currentFolder?.name ?? folder}
              {currentFolder &&
                currentFolder.unseen > 0 &&
                ` · ${currentFolder.unseen} unread`}
              {query && ` · matching “${query}”`}
            </span>
            <span className="font-mono">
              {total === 0
                ? "0"
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isLoading ? (
              <div className="grid gap-3 p-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="grid gap-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))}
              </div>
            ) : list.isError ? (
              <EmptyState
                icon={ShieldAlert}
                title="Could not load this folder"
                description={(list.error as Error).message}
              />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyState
                icon={Mail}
                title={query ? "Nothing matches" : "Nothing here"}
                description={
                  query
                    ? "Try another word — the search covers subject, sender, recipient and body."
                    : "This folder is empty."
                }
              />
            ) : (
              <ul className={cn(list.isFetching && "opacity-70")}>
                {list.data?.items.map((item) => {
                  const active = item.uid === selected;
                  return (
                    <li key={item.uid} className="border-border border-b">
                      <div
                        className={cn(
                          "grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-start gap-2.5 py-2.5 pr-2 pl-3",
                          active ? "bg-sidebar-accent" : "hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1.5 block size-2 rounded-full",
                            item.seen ? "bg-transparent" : "bg-primary",
                          )}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => setSelected(item.uid)}
                          className="min-w-0 text-left"
                          aria-current={active ? "true" : undefined}
                        >
                          <span
                            className={cn(
                              "block truncate",
                              item.seen
                                ? "font-medium"
                                : "text-foreground font-semibold",
                            )}
                          >
                            {personLabel(item.from)}
                          </span>
                          <span
                            className={cn(
                              "block truncate",
                              item.seen
                                ? "text-foreground"
                                : "text-foreground font-medium",
                            )}
                          >
                            {item.subject}
                          </span>
                        </button>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              "font-mono text-[0.6875rem] whitespace-nowrap",
                              item.seen
                                ? "text-muted-foreground"
                                : "text-primary",
                            )}
                          >
                            {when(item.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            {item.hasAttachments && (
                              <Paperclip
                                className="text-muted-foreground size-3"
                                aria-hidden
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => toggleFlag(item)}
                              aria-label={item.flagged ? "Remove star" : "Star"}
                              aria-pressed={item.flagged}
                              className="text-muted-foreground hover:text-foreground rounded p-0.5"
                            >
                              <Star
                                className={cn(
                                  "size-3.5",
                                  item.flagged &&
                                    "fill-[var(--tone-warning)] text-[var(--tone-warning-fg)]",
                                )}
                                aria-hidden
                              />
                            </button>
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {pages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1 || list.isFetching}
                onClick={() => {
                  setPage((p) => p - 1);
                  setSelected(null);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Newer
              </Button>
              <span className="text-muted-foreground font-mono text-xs">
                {page} / {pages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= pages || list.isFetching}
                onClick={() => {
                  setPage((p) => p + 1);
                  setSelected(null);
                }}
              >
                Older
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </section>

        {/* Reading pane */}
        <section aria-label="Message" className="flex min-h-0 flex-col">
          {selected === null ? (
            <EmptyState
              icon={Mail}
              title="Select a message"
              description="Pick something from the list to read it here."
              className="my-auto"
            />
          ) : message.isLoading ? (
            <div className="grid gap-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-40" />
            </div>
          ) : message.isError || !msg ? (
            <EmptyState
              icon={ShieldAlert}
              title="Could not open this message"
              description={
                message.error
                  ? (message.error as Error).message
                  : "It may have been moved."
              }
              className="my-auto"
            />
          ) : (
            <>
              <div className="border-border flex flex-wrap items-center gap-1.5 border-b p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCompose({ mode: "reply", folder, original: msg })
                  }
                >
                  Reply
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCompose({ mode: "replyAll", folder, original: msg })
                  }
                >
                  Reply all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCompose({ mode: "forward", folder, original: msg })
                  }
                >
                  Forward
                </Button>
                <div className="flex-1" />
                {inTrash ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => move(msg.uid, "inbox")}
                  >
                    <ArchiveRestore className="size-4" aria-hidden />
                    Move to Inbox
                  </Button>
                ) : (
                  <>
                    {hasArchive && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Archive"
                        disabled={busy}
                        onClick={() => move(msg.uid, "archive")}
                      >
                        <Archive className="size-4" aria-hidden />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move to Trash"
                      disabled={busy}
                      onClick={() => move(msg.uid, "trash")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => markUnread(msg.uid)}
                >
                  Mark unread
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  {msg.subject}
                </h2>
                <div className="mt-3 flex items-start gap-3">
                  <div className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {(personLabel(msg.from)[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="text-foreground font-semibold">
                        {personLabel(msg.from)}
                      </span>
                      {msg.from?.name && (
                        <span className="text-muted-foreground">
                          {" "}
                          &lt;{msg.from.address}&gt;
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      to {msg.to.map((t) => t.address).join(", ") || "—"}
                      {msg.cc.length > 0 &&
                        ` · cc ${msg.cc.map((t) => t.address).join(", ")}`}
                    </div>
                  </div>
                  <time
                    className="text-muted-foreground shrink-0 font-mono text-xs"
                    dateTime={msg.date ?? undefined}
                  >
                    {when(msg.date, true)}
                  </time>
                </div>
                {msg.blockedRemoteImages > 0 && !allowImages && (
                  <div className="bg-muted text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-xs">
                    <span>
                      {msg.blockedRemoteImages} remote image
                      {msg.blockedRemoteImages === 1 ? "" : "s"} blocked for
                      privacy.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setAllowImages(true)}
                    >
                      Load images
                    </Button>
                  </div>
                )}
                <div
                  className="mail-body [&_a]:text-primary mt-4 max-w-full overflow-x-auto text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_img]:max-w-full [&_p]:my-2 [&_table]:max-w-full"
                  // Sanitised server-side (lib/mail/sanitize.ts); never raw.
                  dangerouslySetInnerHTML={{ __html: msg.html }}
                />
                {msg.attachments.filter((a) => !a.inline).length > 0 && (
                  <div className="border-border mt-5 border-t pt-4">
                    <h3 className="text-muted-foreground mb-2 text-xs font-medium">
                      Attachments
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {msg.attachments
                        .filter((a) => !a.inline)
                        .map((a) => (
                          <li key={a.index}>
                            <a
                              href={`/api/admin/mail/${enc(address)}/messages/${msg.uid}/attachments/${a.index}?folder=${enc(folder)}`}
                              className="bg-card hover:bg-muted/60 border-border flex h-9 items-center gap-2 rounded-md border px-2.5"
                            >
                              <File
                                className="text-muted-foreground size-4"
                                aria-hidden
                              />
                              <span className="flex flex-col leading-tight">
                                <span className="text-xs font-medium">
                                  {a.filename}
                                </span>
                                <span className="text-muted-foreground font-mono text-[0.625rem]">
                                  {humanSize(a.size)}
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          {busy && (
            <div className="text-muted-foreground flex items-center gap-2 px-3 py-1 text-xs">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Working…
            </div>
          )}
        </section>
      </div>
      <ComposePanel
        address={address}
        seed={compose}
        onClose={() => setCompose(null)}
        onSent={() => {
          const wasReply =
            compose?.mode === "reply" || compose?.mode === "replyAll";
          setCompose(null);
          qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
          qc.invalidateQueries({ queryKey: ["mail", address, "list"] });
          if (wasReply && compose?.original) {
            qc.invalidateQueries({
              queryKey: [
                "mail",
                address,
                "message",
                folder,
                compose.original.uid,
              ],
            });
          }
        }}
      />
    </div>
  );
}
