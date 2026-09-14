"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, PenLine, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectField } from "@/components/admin/ui/select-field";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  ConfirmDialog,
  NameDialog,
} from "@/components/admin/company/file-manager/dialogs";
import { cn } from "@/lib/cn";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type {
  ListResult,
  MailFolder,
  MailListItem,
} from "@/lib/mail/store/types";
import type {
  AccessibleMailbox,
  RenderedMessage,
} from "@/lib/services/mail.service";
import { MAIL_LAYOUT_COOKIE, type MailLayout } from "@/lib/mail/layout-cookie";
import {
  ComposePanel,
  type ComposeMode,
  type ComposeSeed,
} from "./compose-panel";
import { MailDisplay, type MoveTarget } from "./mail-display";
import { MailList, sameRow, type Selection } from "./mail-list";
import { MailNav, MailboxSwitcher, STARRED, countFor } from "./mail-nav";
import { MAIL_CHANGED_EVENT, enc, mailApi, useIsDesktop } from "./mail-shared";

/**
 * The mailbox, locked to the viewport: three resizable panes (account +
 * folders · list · reader) that fill the frame and scroll on their own —
 * the page itself never scrolls. Below `lg` it is one pane at a time: the
 * list (with the folder picker above it), or the open message with a back
 * button.
 *
 * Everything comes from `/api/admin/mail/*` through react-query, keyed by
 * address + folder + page + filters, so switching back is instant and a
 * flag change updates the list in place. "Starred" is a view across
 * folders, so every row carries its folder and the selection is
 * `{ folder, uid }`, never a bare uid.
 */
const PAGE_SIZE = 25;

const MOVE_DONE: Record<MoveTarget, string> = {
  trash: "Moved to Trash.",
  archive: "Archived.",
  junk: "Marked as junk.",
  inbox: "Moved to Inbox.",
};

type FolderDialog =
  | { mode: "create" }
  | { mode: "rename"; folder: MailFolder }
  | { mode: "delete"; folder: MailFolder }
  | null;

const FOLDER_ERRORS: Record<string, string> = {
  invalid_name:
    "Use letters, digits, spaces or - _ & ( ) — up to 40 characters.",
  exists: "There is already a folder with that name.",
  reserved: "That folder belongs to the mail server and cannot be changed.",
  not_empty: "Move or delete its messages first — the folder is not empty.",
  not_found: "That folder no longer exists.",
};

export function MailClient({
  mailboxes,
  initialAddress,
  initialFolder,
  initialUid,
  defaultLayout,
}: {
  mailboxes: AccessibleMailbox[];
  initialAddress: string;
  /** Deep link from the bell: open this folder and message on load. */
  initialFolder?: string;
  initialUid?: number;
  defaultLayout?: MailLayout;
}) {
  const qc = useQueryClient();
  const desktop = useIsDesktop();
  const [address, setAddress] = useState(initialAddress);
  const [folder, setFolder] = useState(initialFolder ?? "INBOX");
  const [page, setPage] = useState(1);
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(
    initialUid && initialFolder
      ? { folder: initialFolder, uid: initialUid }
      : null,
  );
  const [allowImages, setAllowImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState<ComposeSeed | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = mailboxes.find((m) => m.address === address) ?? mailboxes[0];
  const starred = folder === STARRED;

  const applyQuery = useDebouncedCallback((q: string) => {
    setQuery(q);
    setPage(1);
    setSelected(null);
  }, 350);

  const folders = useQuery({
    queryKey: ["mail", address, "folders"],
    queryFn: () =>
      mailApi<{ folders: MailFolder[] }>(
        `/api/admin/mail/${enc(address)}/folders`,
      ).then((d) => d.folders),
    staleTime: 30_000,
  });

  const listKey = [
    "mail",
    address,
    "list",
    folder,
    page,
    starred ? "" : query,
    starred ? false : unreadOnly,
  ] as const;
  const list = useQuery({
    queryKey: listKey,
    queryFn: () =>
      mailApi<ListResult>(
        starred
          ? `/api/admin/mail/${enc(address)}/starred?page=${page}&pageSize=${PAGE_SIZE}`
          : `/api/admin/mail/${enc(address)}/messages?folder=${enc(folder)}&page=${page}&pageSize=${PAGE_SIZE}${query ? `&q=${enc(query)}` : ""}${unreadOnly ? "&unseen=1" : ""}`,
      ),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    // The live stream below refreshes on change; this is the fallback.
    refetchInterval: 60_000,
  });

  // Live updates: the server holds an IMAP IDLE on the folder and says when
  // it changed; refetch then (and let the bell know). Starred watches Inbox.
  const watched = starred ? "INBOX" : folder;
  useEffect(() => {
    const es = new EventSource(
      `/api/admin/mail/${enc(address)}/events?folder=${enc(watched)}`,
    );
    const onChange = () => {
      qc.invalidateQueries({ queryKey: ["mail", address, "list"] });
      qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
      window.dispatchEvent(new Event(MAIL_CHANGED_EVENT));
    };
    es.addEventListener("change", onChange);
    // A stream the server ended (mail link dropped) reconnects on its own.
    return () => es.close();
  }, [address, watched, qc]);

  const message = useQuery({
    queryKey: [
      "mail",
      address,
      "message",
      selected?.folder ?? null,
      selected?.uid ?? null,
      allowImages,
    ],
    queryFn: () =>
      mailApi<{ message: RenderedMessage }>(
        `/api/admin/mail/${enc(address)}/messages/${selected!.uid}?folder=${enc(selected!.folder)}${allowImages ? "&images=1" : ""}`,
      ).then((d) => d.message),
    enabled: selected !== null,
    staleTime: 60_000,
  });

  const items = list.data?.items ?? [];
  const folderList = folders.data ?? [];
  const folderNames = new Map(folderList.map((f) => [f.path, f.name]));
  const currentFolder = folderList.find((f) => f.path === folder);
  const readerFolder = selected?.folder ?? folder;
  const readerSpecial =
    folderList.find((f) => f.path === readerFolder)?.specialUse ?? null;
  const hasArchive = folderList.some((f) => f.specialUse === "archive");
  const hasJunk = folderList.some((f) => f.specialUse === "junk");
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const msg = message.data ?? null;
  const title = starred ? "Starred" : (currentFolder?.name ?? folder);

  // ── cache helpers ────────────────────────────────────────────────────
  const messageKey = (row: Selection) => [
    "mail",
    address,
    "message",
    row.folder,
    row.uid,
  ];
  const patchItem = (row: Selection, patch: Partial<MailListItem>) => {
    qc.setQueryData<ListResult>(listKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((i) =>
              sameRow(row, i) ? { ...i, ...patch } : i,
            ),
          }
        : old,
    );
  };
  const refreshFolder = () => {
    qc.invalidateQueries({ queryKey: ["mail", address, "list"] });
    qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
  };

  // Opening marks read on the server; mirror it in the list (a query-cache
  // write, not component state — safe in an effect).
  const opened = message.data?.seen && selected ? selected : null;
  useEffect(() => {
    if (!opened) return;
    qc.setQueryData<ListResult>(listKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((i) =>
              sameRow(opened, i) && !i.seen ? { ...i, seen: true } : i,
            ),
          }
        : old,
    );
    qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listKey derives from the same state
  }, [opened?.folder, opened?.uid]);

  // ── navigation ───────────────────────────────────────────────────────
  function switchMailbox(next: string) {
    setAddress(next);
    setFolder("INBOX");
    setPage(1);
    setSelected(null);
    setQueryText("");
    setQuery("");
    setUnreadOnly(false);
  }
  function switchFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelected(null);
  }
  function open(row: Selection | null) {
    setSelected(row);
    setAllowImages(false);
  }
  function step(delta: 1 | -1) {
    if (items.length === 0) return;
    const idx = items.findIndex((i) => sameRow(selected, i));
    const next =
      idx < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : Math.min(items.length - 1, Math.max(0, idx + delta));
    open({ folder: items[next].folder, uid: items[next].uid });
  }
  function startCompose(mode: ComposeMode) {
    setCompose({
      mode,
      folder: readerFolder,
      original: mode === "new" ? null : msg,
    });
  }

  // ── actions ──────────────────────────────────────────────────────────
  async function flag(
    row: Selection,
    patch: { seen?: boolean; flagged?: boolean },
  ) {
    const before = items.find((i) => sameRow(row, i));
    patchItem(row, patch);
    try {
      await mailApi(
        `/api/admin/mail/${enc(address)}/messages/${row.uid}/flags`,
        {
          method: "POST",
          body: JSON.stringify({ folder: row.folder, ...patch }),
        },
      );
      qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
      if (patch.seen === false) {
        // Close it and drop the cached copy. Never invalidate here: a refetch
        // while the reader is still mounted would open (and re-read) it.
        if (sameRow(selected, row)) open(null);
        qc.removeQueries({ queryKey: messageKey(row) });
      } else {
        qc.setQueriesData<RenderedMessage>(
          { queryKey: messageKey(row) },
          (old) => (old ? { ...old, ...patch } : old),
        );
      }
      if (patch.flagged !== undefined) {
        // The Starred view and its count follow the flag.
        qc.invalidateQueries({ queryKey: ["mail", address, "list", STARRED] });
      }
    } catch (e) {
      if (before)
        patchItem(row, { seen: before.seen, flagged: before.flagged });
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  }

  async function moveRow(
    row: Selection,
    body: { to: MoveTarget } | { toPath: string },
    done: string,
  ) {
    setBusy(true);
    try {
      await mailApi(
        `/api/admin/mail/${enc(address)}/messages/${row.uid}/move`,
        {
          method: "POST",
          body: JSON.stringify({ folder: row.folder, ...body }),
        },
      );
      toast.success(done);
      if (sameRow(selected, row)) {
        // Land on the next message so working through a queue flows.
        const idx = items.findIndex((i) => sameRow(row, i));
        const rest = items.filter((i) => !sameRow(row, i));
        const next = rest[Math.min(idx, rest.length - 1)];
        open(desktop && next ? { folder: next.folder, uid: next.uid } : null);
      }
      qc.removeQueries({ queryKey: messageKey(row) });
      refreshFolder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move.");
    } finally {
      setBusy(false);
    }
  }
  const move = (row: Selection, to: MoveTarget) =>
    moveRow(row, { to }, MOVE_DONE[to]);
  const moveTo = (row: Selection, path: string) =>
    moveRow(
      row,
      { toPath: path },
      `Moved to ${folderNames.get(path) ?? path}.`,
    );

  // ── folders ──────────────────────────────────────────────────────────
  const starredCount = useQuery({
    queryKey: ["mail", address, "list", STARRED, "count"],
    queryFn: () =>
      mailApi<ListResult>(
        `/api/admin/mail/${enc(address)}/starred?page=1&pageSize=5`,
      ).then((d) => d.total),
    staleTime: 60_000,
  });

  async function folderAction(value?: string) {
    const d = folderDialog;
    if (!d) return;
    setBusy(true);
    try {
      if (d.mode === "create") {
        const res = await mailApi<{ folder: MailFolder }>(
          `/api/admin/mail/${enc(address)}/folders`,
          { method: "POST", body: JSON.stringify({ name: value }) },
        );
        toast.success(`Folder "${res.folder.name}" created.`);
        switchFolder(res.folder.path);
      } else if (d.mode === "rename") {
        const res = await mailApi<{ folder: MailFolder }>(
          `/api/admin/mail/${enc(address)}/folders/${enc(d.folder.path)}`,
          { method: "PATCH", body: JSON.stringify({ name: value }) },
        );
        toast.success(`Renamed to "${res.folder.name}".`);
        if (folder === d.folder.path) switchFolder(res.folder.path);
      } else {
        await mailApi(
          `/api/admin/mail/${enc(address)}/folders/${enc(d.folder.path)}`,
          { method: "DELETE" },
        );
        toast.success(`Folder "${d.folder.name}" deleted.`);
        if (folder === d.folder.path) switchFolder("INBOX");
      }
      setFolderDialog(null);
      qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      toast.error(FOLDER_ERRORS[code] ?? code ?? "Could not change folders.");
    } finally {
      setBusy(false);
    }
  }

  // ── keyboard ─────────────────────────────────────────────────────────
  // Re-bound every render on purpose: the handler closes over the current
  // list, selection and folder.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (
        typing ||
        compose ||
        folderDialog ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const it = items.find((i) => sameRow(selected, i));
      const row = it ? { folder: it.folder, uid: it.uid } : null;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          step(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          step(-1);
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "c":
          startCompose("new");
          break;
        case "Escape":
          open(null);
          break;
        case "e":
          if (row && hasArchive && readerSpecial !== "archive")
            move(row, "archive");
          break;
        case "#":
        case "Delete":
          if (row && readerSpecial !== "trash") move(row, "trash");
          break;
        case "u":
          if (row && it) flag(row, { seen: !it.seen });
          break;
        case "s":
          if (row && it) flag(row, { flagged: !it.flagged });
          break;
        case "r":
          if (msg) startCompose("reply");
          break;
        case "a":
          if (msg) startCompose("replyAll");
          break;
        case "f":
          if (msg) startCompose("forward");
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── pieces ───────────────────────────────────────────────────────────
  const switcher = (
    <MailboxSwitcher
      mailboxes={mailboxes}
      value={address}
      onChange={switchMailbox}
    />
  );

  const badges =
    current?.elevated || current?.status === "disabled" ? (
      <div className="flex flex-wrap gap-1 px-4 pb-2">
        {current.elevated && (
          <StatusBadge tone="warning">
            Opened as super admin · audited
          </StatusBadge>
        )}
        {current.status === "disabled" && (
          <StatusBadge tone="neutral">Mailbox login disabled</StatusBadge>
        )}
      </div>
    ) : null;

  const nav = folders.isLoading ? (
    <div className="grid gap-1 px-2 py-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-7 rounded-md" />
      ))}
    </div>
  ) : folders.isError ? (
    <p className="text-destructive px-4 py-2 text-xs">
      {(folders.error as Error).message}
    </p>
  ) : (
    <MailNav
      folders={folderList}
      active={folder}
      starredCount={starredCount.data}
      onSelect={switchFolder}
      onCreate={() => setFolderDialog({ mode: "create" })}
      onRename={(f) => setFolderDialog({ mode: "rename", folder: f })}
      onDelete={(f) => setFolderDialog({ mode: "delete", folder: f })}
    />
  );

  const listHeader = (
    <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
      <h1 className="truncate text-xl font-bold">{title}</h1>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh"
            onClick={() => {
              refreshFolder();
              if (selected) {
                qc.invalidateQueries({ queryKey: messageKey(selected) });
              }
            }}
          >
            <RefreshCw
              className={cn("size-4", list.isFetching && "animate-spin")}
              aria-hidden
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Compose"
            onClick={() => startCompose("new")}
          >
            <PenLine className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compose</TooltipContent>
      </Tooltip>
      {!starred && (
        <TabsList className="ml-auto h-8">
          <TabsTrigger value="all" className="px-1.5">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="px-1.5">
            Unread
          </TabsTrigger>
        </TabsList>
      )}
    </div>
  );

  const search = starred ? (
    <div className="text-muted-foreground shrink-0 px-4 pb-3 text-xs">
      Everything you starred, from every folder but Junk and Trash.
    </div>
  ) : (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 shrink-0 p-4 backdrop-blur">
      <div className="relative">
        <Search
          className="text-muted-foreground absolute top-2 left-2.5 size-4"
          aria-hidden
        />
        <Input
          ref={searchRef}
          value={queryText}
          onChange={(e) => {
            setQueryText(e.target.value);
            applyQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder="Search"
          aria-label="Search messages"
          className="h-8 rounded-lg pl-8"
        />
      </div>
    </div>
  );

  const listPane = (
    <Tabs
      value={unreadOnly && !starred ? "unread" : "all"}
      onValueChange={(v) => {
        setUnreadOnly(v === "unread");
        setPage(1);
        setSelected(null);
      }}
      className="flex h-full flex-col gap-0"
    >
      {listHeader}
      <Separator />
      {badges}
      {search}
      <MailList
        items={items}
        selected={selected}
        onSelect={open}
        folderNames={starred ? folderNames : undefined}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.isError ? (list.error as Error).message : null}
        emptyTitle={
          starred
            ? "Nothing starred"
            : query
              ? "Nothing matches"
              : unreadOnly
                ? "All read"
                : "Nothing here"
        }
        emptyHint={
          starred
            ? "Star a message from its menu, or press s while reading it."
            : query
              ? "The search covers subject, sender, recipient and body."
              : unreadOnly
                ? "No unread messages in this folder."
                : "This folder is empty."
        }
        page={page}
        pages={pages}
        onPage={(p) => {
          setPage(p);
          setSelected(null);
        }}
      />
    </Tabs>
  );

  const display = (
    <MailDisplay
      address={address}
      folder={readerFolder}
      special={readerSpecial}
      folders={folderList}
      hasArchive={hasArchive}
      hasJunk={hasJunk}
      message={msg}
      loading={selected !== null && message.isLoading}
      error={
        selected !== null && message.isError
          ? (message.error as Error).message
          : null
      }
      busy={busy}
      allowImages={allowImages}
      onAllowImages={() => setAllowImages(true)}
      onMove={(uid, to) => move({ folder: readerFolder, uid }, to)}
      onMoveTo={(uid, path) => moveTo({ folder: readerFolder, uid }, path)}
      onFlag={(uid, patch) => flag({ folder: readerFolder, uid }, patch)}
      onCompose={startCompose}
      onSent={() => {
        qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
        qc.invalidateQueries({ queryKey: ["mail", address, "list"] });
        if (selected) qc.invalidateQueries({ queryKey: messageKey(selected) });
      }}
      onBack={desktop ? undefined : () => open(null)}
    />
  );

  return (
    // Viewport minus the topbar and the page padding; the panes share the rest.
    <div className="bg-card text-card-foreground h-[calc(100dvh-6rem)] min-h-[30rem] overflow-hidden rounded-md border">
      {desktop ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full items-stretch"
          defaultLayout={defaultLayout}
          onLayoutChanged={(layout) => {
            document.cookie = `${MAIL_LAYOUT_COOKIE}=${encodeURIComponent(JSON.stringify(layout))}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          <ResizablePanel
            id="nav"
            defaultSize={208}
            minSize={184}
            maxSize={300}
            className="flex flex-col"
          >
            {switcher}
            <Separator />
            <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            id="list"
            defaultSize={340}
            minSize={280}
            maxSize={520}
            className="flex flex-col"
          >
            {listPane}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="display" minSize={360}>
            {display}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : selected !== null ? (
        display
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex h-[52px] shrink-0 items-center gap-2 px-2">
            <AtSign
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <SelectField
              value={address}
              onChange={switchMailbox}
              ariaLabel="Mailbox"
              options={mailboxes.map((m) => ({
                value: m.address,
                label: m.address,
              }))}
              className="h-8 min-w-0 flex-1 rounded-lg [&>span]:truncate"
            />
            <SelectField
              value={folder}
              onChange={switchFolder}
              ariaLabel="Folder"
              options={[
                ...folderList.map((f) => ({
                  value: f.path,
                  label:
                    countFor(f) > 0 ? `${f.name} (${countFor(f)})` : f.name,
                })),
                { value: STARRED, label: "Starred" },
              ]}
              className="h-8 w-32 shrink-0 rounded-lg"
            />
          </div>
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col">{listPane}</div>
        </div>
      )}

      <ComposePanel
        address={address}
        seed={compose}
        onClose={() => setCompose(null)}
        onSent={() => {
          const wasReply =
            compose?.mode === "reply" || compose?.mode === "replyAll";
          const original = compose?.original ?? null;
          const seedFolder = compose?.folder ?? folder;
          setCompose(null);
          qc.invalidateQueries({ queryKey: ["mail", address, "folders"] });
          qc.invalidateQueries({ queryKey: ["mail", address, "list"] });
          if (wasReply && original) {
            qc.invalidateQueries({
              queryKey: messageKey({ folder: seedFolder, uid: original.uid }),
            });
          }
        }}
      />

      <NameDialog
        open={folderDialog?.mode === "create"}
        title="New folder"
        label="Folder name"
        confirmLabel="Create folder"
        busy={busy}
        onCancel={() => setFolderDialog(null)}
        onConfirm={(v) => void folderAction(v)}
      />
      <NameDialog
        open={folderDialog?.mode === "rename"}
        title="Rename folder"
        label="Folder name"
        initial={
          folderDialog?.mode === "rename" ? folderDialog.folder.name : ""
        }
        confirmLabel="Rename"
        busy={busy}
        onCancel={() => setFolderDialog(null)}
        onConfirm={(v) => void folderAction(v)}
      />
      <ConfirmDialog
        open={folderDialog?.mode === "delete"}
        title={
          folderDialog?.mode === "delete"
            ? `Delete "${folderDialog.folder.name}"?`
            : "Delete folder?"
        }
        body={
          folderDialog?.mode === "delete" && folderDialog.folder.total > 0
            ? `This folder still holds ${folderDialog.folder.total} message${folderDialog.folder.total === 1 ? "" : "s"}. Move or delete them first — deleting a folder never deletes mail.`
            : "The folder is empty; deleting it removes it from the mail server for every mail app."
        }
        confirmLabel="Delete folder"
        destructive
        busy={busy}
        onCancel={() => setFolderDialog(null)}
        onConfirm={() => void folderAction()}
      />
    </div>
  );
}
