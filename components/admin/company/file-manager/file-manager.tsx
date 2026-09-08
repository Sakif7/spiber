"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Copy,
  Download,
  FolderPlus,
  Grid3x3,
  Home,
  List as ListIcon,
  Loader2,
  MoveRight,
  Pencil,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { formatApiError } from "@/lib/http/form-error";
import { useSelection } from "./use-selection";
import { ItemList, ItemGrid, FolderTree } from "./views";
import {
  NameDialog,
  FolderPickerDialog,
  ConfirmDialog,
  PreviewDialog,
} from "./dialogs";
import {
  DND_MIME,
  formatBytes,
  isPreviewable,
  refKey,
  type FileNode,
  type FolderNode,
  type ItemRef,
  type ListPayload,
  type SortDir,
  type SortKey,
  type ViewMode,
} from "./types";

const API = "/api/admin/company/fs";

type DialogState =
  | { kind: "none" }
  | { kind: "new-folder" }
  | { kind: "rename"; ref: ItemRef; current: string }
  | { kind: "move" | "copy" }
  | { kind: "confirm-trash" }
  | { kind: "confirm-purge" };

/**
 * The company vault, as a file manager.
 *
 * Location and view options live in the URL (`?folder=&view=&sort=&dir=&q=&trash=`)
 * so a folder can be linked to and the back button works. The listing itself is
 * fetched as JSON rather than re-rendered on the server, so navigating a tree
 * does not reload the page.
 */
export function FileManager({
  initial,
  initialTree,
}: {
  initial: ListPayload;
  initialTree: FolderNode[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const folderId = params.get("folder");
  const view = (params.get("view") as ViewMode) ?? "list";
  const sort = (params.get("sort") as SortKey) ?? "name";
  const dir = (params.get("dir") as SortDir) ?? "asc";
  const query = params.get("q") ?? "";
  const recursive = params.get("recursive") === "1";
  const trash = params.get("trash") === "1";

  const [data, setData] = useState<ListPayload>(initial);
  const [tree, setTree] = useState<FolderNode[]>(initialTree);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [preview, setPreview] = useState<FileNode | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(query);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const order = useMemo<ItemRef[]>(
    () => [
      ...data.folders.map((f) => ({ kind: "folder" as const, id: f.id })),
      ...data.files.map((f) => ({ kind: "file" as const, id: f.id })),
    ],
    [data],
  );
  const sel = useSelection(order);

  // ── URL helpers ──────────────────────────────────────────────────────────
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (folderId) qs.set("folder", folderId);
      if (sort) qs.set("sort", sort);
      if (dir) qs.set("dir", dir);
      if (query) qs.set("q", query);
      if (recursive) qs.set("recursive", "1");
      if (trash) qs.set("trash", "1");
      const [listRes, treeRes] = await Promise.all([
        fetch(`${API}?${qs.toString()}`),
        fetch(`${API}/tree`),
      ]);
      const listJson = await listRes.json().catch(() => null);
      const treeJson = await treeRes.json().catch(() => null);
      if (listRes.ok && listJson?.data) setData(listJson.data);
      if (treeRes.ok && treeJson?.data) setTree(treeJson.data.folders);
    } finally {
      setLoading(false);
    }
  }, [folderId, sort, dir, query, recursive, trash]);

  // Re-fetch whenever the location or the view options change.
  const [lastKey, setLastKey] = useState(
    `${folderId}|${sort}|${dir}|${query}|${recursive}|${trash}`,
  );
  const key = `${folderId}|${sort}|${dir}|${query}|${recursive}|${trash}`;
  if (key !== lastKey) {
    setLastKey(key);
    sel.clear();
    void refresh();
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    if (searchText === query) return;
    const t = setTimeout(() => setParams({ q: searchText || null }), 300);
    return () => clearTimeout(t);
  }, [searchText, query, setParams]);

  // ── actions ──────────────────────────────────────────────────────────────
  async function call(
    path: string,
    init: RequestInit,
    okMessage?: string,
  ): Promise<unknown | null> {
    setBusy(true);
    try {
      const res = await fetch(path, init);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "That didn't work."));
        return null;
      }
      if (okMessage) toast.success(okMessage);
      await refresh();
      return json?.data ?? true;
    } finally {
      setBusy(false);
    }
  }

  const bulk = (
    op: "move" | "copy" | "trash" | "restore" | "purge",
    targetId: string | null,
    refs: { folderIds: string[]; fileIds: string[] },
    okMessage: string,
  ) =>
    call(
      `${API}/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, targetId, ...refs }),
      },
      okMessage,
    ).then((r) => {
      sel.clear();
      return r;
    });

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setUploads(files.map((f) => ({ name: f.name, pct: 0 })));
    const form = new FormData();
    for (const f of files) form.append("file", f);
    if (folderId) form.set("folderId", folderId);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/upload`);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploads((prev) => prev.map((u) => ({ ...u, pct })));
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText) as {
            ok?: boolean;
            data?: {
              stored: number;
              failed: number;
              results: { ok: boolean; filename?: string; code?: string }[];
            };
            error?: { code?: string };
          };
          if (xhr.status >= 400 || !json.ok) {
            toast.error(formatApiError(json, "Upload failed."));
          } else if (json.data) {
            const { stored, failed, results } = json.data;
            if (stored > 0) {
              toast.success(
                `${stored} file${stored === 1 ? "" : "s"} uploaded.`,
              );
            }
            // Say which files were rejected and why, rather than a bare count.
            for (const r of results.filter((x) => !x.ok)) {
              toast.error(`${r.filename}: ${r.code?.replace(/_/g, "")}`);
            }
            if (stored === 0 && failed === 0) toast.error("Nothing uploaded.");
          }
        } catch {
          toast.error("Upload failed.");
        }
        resolve();
      };
      xhr.onerror = () => {
        toast.error("Upload failed.");
        resolve();
      };
      xhr.send(form);
    });

    setUploads([]);
    await refresh();
  }

  // ── drag and drop ────────────────────────────────────────────────────────
  const dragProps = useCallback(
    (ref: ItemRef) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        // Dragging an unselected item selects it first, so the drag payload is
        // always exactly what the user can see highlighted.
        const refs = sel.isSelected(ref) ? sel.refs : [ref];
        if (!sel.isSelected(ref)) sel.ensure(ref);
        e.dataTransfer.setData(DND_MIME, JSON.stringify(refs));
        e.dataTransfer.effectAllowed = "move";
      },
    }),
    [sel],
  );

  const dropProps = useCallback(
    (targetFolderId: string | null) => ({
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTargetId(targetFolderId ?? "root");
      },
      onDragLeave: () => setDropTargetId(null),
      onDrop: (e: React.DragEvent) => {
        const raw = e.dataTransfer.getData(DND_MIME);
        setDropTargetId(null);
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        const refs = JSON.parse(raw) as ItemRef[];
        const folderIds = refs
          .filter((r) => r.kind === "folder")
          .map((r) => r.id);
        const fileIds = refs.filter((r) => r.kind === "file").map((r) => r.id);
        if (folderIds.includes(targetFolderId ?? "")) return;
        void bulk("move", targetFolderId, { folderIds, fileIds }, "Moved.");
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bulk is stable enough
    [folderId],
  );

  // Files dragged in from the desktop.
  const pageDrop = {
    onDragEnter: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      dragDepth.current += 1;
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
    },
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("Files")) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      dragDepth.current = 0;
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      void upload(files);
    },
  };

  // ── keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        sel.selectAll();
      } else if (e.key === "Delete" && sel.count > 0) {
        e.preventDefault();
        setDialog({ kind: trash ? "confirm-purge" : "confirm-trash" });
      } else if (e.key === "Escape") {
        sel.clear();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, trash]);

  // ── derived ──────────────────────────────────────────────────────────────
  const usagePct = data.usage.quotaBytes
    ? Math.min(100, (data.usage.usedBytes / data.usage.quotaBytes) * 100)
    : 0;

  // A folder cannot be moved into itself or its own subtree.
  const blockedTargets = useMemo(() => {
    const blocked = new Set(sel.folderIds);
    for (const f of tree) {
      if (sel.folderIds.some((id) => isDescendant(tree, f.id, id)))
        blocked.add(f.id);
    }
    return blocked;
  }, [sel.folderIds, tree]);

  const previewables = data.files.filter((f) => isPreviewable(f.contentType));
  const previewIndex = preview
    ? previewables.findIndex((f) => f.id === preview.id)
    : -1;

  const downloadHref = () => {
    const qs = new URLSearchParams();
    if (sel.folderIds.length) qs.set("folderIds", sel.folderIds.join(","));
    if (sel.fileIds.length) qs.set("fileIds", sel.fileIds.join(","));
    return `${API}/download?${qs.toString()}`;
  };

  const selectionLabel = `${sel.count} selected`;

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr]" {...pageDrop}>
      {/* Sidebar: tree + usage */}
      <aside className="hidden flex-col gap-3 lg:flex">
        <div className="bg-card rounded-lg border p-2">
          <FolderTree
            tree={tree}
            currentId={folderId}
            onOpen={(id) => setParams({ folder: id, trash: null, q: null })}
            dropProps={dropProps}
            dropTargetId={dropTargetId}
          />
        </div>
        <div className="bg-card rounded-lg border p-3">
          <Progress value={usagePct} className="h-1.5" />
          <p className="text-muted-foreground mt-2 text-xs">
            {formatBytes(data.usage.usedBytes)} of{" "}
            {formatBytes(data.usage.quotaBytes)} used
          </p>
          {data.usage.trashBytes > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatBytes(data.usage.trashBytes)} in the trash
            </p>
          )}
          <Button
            variant={trash ? "default" : "ghost"}
            size="sm"
            className="mt-2 w-full justify-start gap-2"
            onClick={() =>
              setParams({ trash: trash ? null : "1", folder: null, q: null })
            }
          >
            <Trash2 className="size-4" />
            {trash ? "Back to files" : "Trash"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        {/* Toolbar */}
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-2">
          {!trash && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setDialog({ kind: "new-folder" })}
              >
                <FolderPlus className="size-4" />
                New folder
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  void upload(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </>
          )}

          <div className="relative min-w-[180px] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search documents…"
              className="h-8 pl-8"
            />
            {searchText && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchText("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) =>
                setParams({ recursive: e.target.checked ? "1" : null })
              }
            />
            Include subfolders
          </label>

          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant={view === "list" ? "secondary" : "ghost"}
              className="size-8"
              aria-label="List view"
              onClick={() => setParams({ view: null })}
            >
              <ListIcon className="size-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "grid" ? "secondary" : "ghost"}
              className="size-8"
              aria-label="Grid view"
              onClick={() => setParams({ view: "grid" })}
            >
              <Grid3x3 className="size-4" />
            </Button>
          </div>

          {loading && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          )}
        </div>

        {/* Breadcrumb */}
        {!trash && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-1">
            <button
              type="button"
              {...dropProps(null)}
              onClick={() => setParams({ folder: null })}
              className="hover:text-foreground flex items-center gap-1 rounded px-1"
            >
              <Home className="size-3.5" />
              Documents
            </button>
            {data.breadcrumb.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="size-3.5 opacity-50" />
                <button
                  type="button"
                  {...dropProps(f.id)}
                  onClick={() => setParams({ folder: f.id })}
                  className={cn(
                    "hover:text-foreground rounded px-1",
                    f.id === folderId && "text-foreground font-medium",
                    dropTargetId === f.id && "ring-primary ring-2",
                  )}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Selection bar */}
        {sel.count > 0 && (
          <div className="bg-accent flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
            <span className="font-medium">{selectionLabel}</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {trash ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      void bulk(
                        "restore",
                        null,
                        { folderIds: sel.folderIds, fileIds: sel.fileIds },
                        "Restored.",
                      )
                    }
                  >
                    <Undo2 className="size-4" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setDialog({ kind: "confirm-purge" })}
                  >
                    <Trash2 className="size-4" />
                    Delete permanently
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                  >
                    <a href={downloadHref()}>
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDialog({ kind: "move" })}
                  >
                    <MoveRight className="size-4" />
                    Move
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDialog({ kind: "copy" })}
                  >
                    <Copy className="size-4" />
                    Copy
                  </Button>
                  {sel.count === 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        const ref = sel.refs[0]!;
                        const name =
                          ref.kind === "folder"
                            ? (data.folders.find((f) => f.id === ref.id)
                                ?.name ?? "")
                            : (data.files.find((f) => f.id === ref.id)?.title ??
                              "");
                        setDialog({ kind: "rename", ref, current: name });
                      }}
                    >
                      <Pencil className="size-4" />
                      Rename
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setDialog({ kind: "confirm-trash" })}
                  >
                    <Trash2 className="size-4" />
                    Move to trash
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={sel.clear}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="bg-card grid gap-1.5 rounded-lg border p-3">
            {uploads.map((u) => (
              <div key={u.name} className="grid gap-1">
                <span className="truncate text-xs">{u.name}</span>
                <Progress value={u.pct} className="h-1" />
              </div>
            ))}
          </div>
        )}

        {/* Listing */}
        <div
          className="bg-card min-h-[240px] rounded-lg border"
          onClick={(e) => {
            // A click on the empty area clears the selection.
            if (e.target === e.currentTarget) sel.clear();
          }}
        >
          {data.folders.length === 0 && data.files.length === 0 ? (
            <p className="text-muted-foreground p-10 text-center text-sm">
              {trash
                ? "The trash is empty."
                : query
                  ? "Nothing matches that search."
                  : "This folder is empty — upload a document or create a folder."}
            </p>
          ) : view === "grid" ? (
            <ItemGrid
              folders={data.folders}
              files={data.files}
              isSelected={sel.isSelected}
              onItemClick={sel.click}
              onOpenFolder={(id) => setParams({ folder: id, q: null })}
              onOpenFile={setPreview}
              onContextMenu={(ref, e) => {
                e.preventDefault();
                sel.ensure(ref);
              }}
              dragProps={dragProps}
              dropProps={dropProps}
              dropTargetId={dropTargetId}
            />
          ) : (
            <ItemList
              sort={sort}
              dir={dir}
              onSort={(k) =>
                setParams({
                  sort: k === "name" ? null : k,
                  dir: sort === k && dir === "asc" ? "desc" : null,
                })
              }
              folders={data.folders}
              files={data.files}
              isSelected={sel.isSelected}
              onItemClick={sel.click}
              onOpenFolder={(id) => setParams({ folder: id, q: null })}
              onOpenFile={setPreview}
              onContextMenu={(ref, e) => {
                e.preventDefault();
                sel.ensure(ref);
              }}
              dragProps={dragProps}
              dropProps={dropProps}
              dropTargetId={dropTargetId}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <NameDialog
        open={dialog.kind === "new-folder"}
        title="New folder"
        label="Folder name"
        confirmLabel="Create"
        busy={busy}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async (name) => {
          const created = await call(
            `${API}/folders`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, parentId: folderId }),
            },
            "Folder created.",
          );
          if (created) setDialog({ kind: "none" });
        }}
      />

      <NameDialog
        open={dialog.kind === "rename"}
        title="Rename"
        label="Name"
        initial={dialog.kind === "rename" ? dialog.current : ""}
        confirmLabel="Save"
        busy={busy}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async (name) => {
          if (dialog.kind !== "rename") return;
          const isFolder = dialog.ref.kind === "folder";
          const done = await call(
            `${API}/${isFolder ? "folders" : "files"}/${dialog.ref.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(isFolder ? { name } : { title: name }),
            },
            "Renamed.",
          );
          if (done) setDialog({ kind: "none" });
        }}
      />

      <FolderPickerDialog
        open={dialog.kind === "move" || dialog.kind === "copy"}
        title={dialog.kind === "copy" ? "Copy to" : "Move to"}
        confirmLabel={dialog.kind === "copy" ? "Copy" : "Move"}
        tree={tree}
        disabledIds={blockedTargets}
        busy={busy}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async (targetId) => {
          const op = dialog.kind === "copy" ? "copy" : "move";
          await bulk(
            op,
            targetId,
            { folderIds: sel.folderIds, fileIds: sel.fileIds },
            op === "copy" ? "Copied." : "Moved.",
          );
          setDialog({ kind: "none" });
        }}
      />

      <ConfirmDialog
        open={dialog.kind === "confirm-trash"}
        title={`Move ${selectionLabel.toLowerCase()} to the trash?`}
        body="Items in the trash can be restored. Nothing is deleted permanently until you empty the trash."
        confirmLabel="Move to trash"
        destructive
        busy={busy}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async () => {
          await bulk(
            "trash",
            null,
            { folderIds: sel.folderIds, fileIds: sel.fileIds },
            "Moved to the trash.",
          );
          setDialog({ kind: "none" });
        }}
      />

      <ConfirmDialog
        open={dialog.kind === "confirm-purge"}
        title={`Permanently delete ${selectionLabel.toLowerCase()}?`}
        body="The encrypted files are removed from storage. This cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        busy={busy}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={async () => {
          await bulk(
            "purge",
            null,
            { folderIds: sel.folderIds, fileIds: sel.fileIds },
            "Deleted permanently.",
          );
          setDialog({ kind: "none" });
        }}
      />

      <PreviewDialog
        file={preview}
        onClose={() => setPreview(null)}
        onPrev={
          previewIndex > 0
            ? () => setPreview(previewables[previewIndex - 1]!)
            : undefined
        }
        onNext={
          previewIndex >= 0 && previewIndex < previewables.length - 1
            ? () => setPreview(previewables[previewIndex + 1]!)
            : undefined
        }
      />
    </div>
  );
}

/** Is `id` inside `ancestorId`'s subtree, per the flat tree list? */
function isDescendant(
  tree: FolderNode[],
  id: string,
  ancestorId: string,
): boolean {
  const byId = new Map(tree.map((f) => [f.id, f]));
  let cur = byId.get(id);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

export { refKey };
