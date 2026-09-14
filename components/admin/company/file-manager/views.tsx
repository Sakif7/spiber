"use client";

import { ArrowDown, ArrowUp, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";
import { iconForFile } from "./icons";
import {
  formatBytes,
  typeLabel,
  type FileNode,
  type FolderNode,
  type ItemRef,
  type SortDir,
  type SortKey,
} from "./types";

/** Props every row/tile needs, so list and grid stay interchangeable. */
export type ItemViewProps = {
  folders: FolderNode[];
  files: FileNode[];
  isSelected: (ref: ItemRef) => boolean;
  onItemClick: (
    ref: ItemRef,
    mods: { shift?: boolean; ctrl?: boolean },
  ) => void;
  onOpenFolder: (id: string) => void;
  onOpenFile: (file: FileNode) => void;
  onContextMenu: (ref: ItemRef, e: React.MouseEvent) => void;
  dragProps: (ref: ItemRef) => React.HTMLAttributes<HTMLElement> & {
    draggable?: boolean;
  };
  dropProps: (folderId: string) => React.HTMLAttributes<HTMLElement>;
  dropTargetId: string | null;
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function SortButton({
  label,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        "hover:text-foreground inline-flex items-center gap-1 font-medium",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        ))}
    </button>
  );
}

/** Detail view: name, type, size, modified, uploader. */
export function ItemList({
  sort,
  dir,
  onSort,
  ...p
}: ItemViewProps & {
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const cell = "px-3 py-2";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b">
            <th className={cn(cell, "w-8")} />
            <th className={cn(cell, "text-left")}>
              <SortButton
                label="Name"
                active={sort === "name"}
                dir={dir}
                onSort={() => onSort("name")}
              />
            </th>
            <th className={cn(cell, "w-32 text-left whitespace-nowrap")}>
              <SortButton
                label="Type"
                active={sort === "type"}
                dir={dir}
                onSort={() => onSort("type")}
              />
            </th>
            <th className={cn(cell, "w-24 text-right")}>
              <SortButton
                label="Size"
                active={sort === "size"}
                dir={dir}
                onSort={() => onSort("size")}
                className="ml-auto"
              />
            </th>
            <th className={cn(cell, "w-32 text-left whitespace-nowrap")}>
              <SortButton
                label="Modified"
                active={sort === "modified"}
                dir={dir}
                onSort={() => onSort("modified")}
              />
            </th>
            <th
              className={cn(
                cell,
                "text-muted-foreground w-64 text-left whitespace-nowrap",
              )}
            >
              Uploaded by
            </th>
          </tr>
        </thead>
        <tbody>
          {p.folders.map((f) => {
            const ref: ItemRef = { kind: "folder", id: f.id };
            const selected = p.isSelected(ref);
            return (
              <tr
                key={f.id}
                {...p.dragProps(ref)}
                {...p.dropProps(f.id)}
                onClick={(e) =>
                  p.onItemClick(ref, {
                    shift: e.shiftKey,
                    ctrl: e.ctrlKey || e.metaKey,
                  })
                }
                onDoubleClick={() => p.onOpenFolder(f.id)}
                onContextMenu={(e) => p.onContextMenu(ref, e)}
                className={cn(
                  "hover:bg-accent/50 cursor-default border-b",
                  selected && "bg-accent",
                  p.dropTargetId === f.id && "ring-primary bg-primary/5 ring-2",
                )}
              >
                <td className={cell}>
                  <Checkbox
                    checked={selected}
                    aria-label={`Select ${f.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onItemClick(ref, { ctrl: true });
                    }}
                  />
                </td>
                <td className={cell}>
                  <span className="flex min-w-0 items-center gap-2">
                    <FolderIcon className="text-primary size-4 shrink-0" />
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="block truncate font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onOpenFolder(f.id);
                        }}
                      >
                        {f.name}
                      </button>
                      {/* How much is inside sits under the name, where the Name
                          column's spare width actually is. It was in Type,
                          which is 112px wide and wrapped it onto two lines. */}
                      <span className="text-muted-foreground text-admin-xs block">
                        {f.itemCount
                          ? `${f.itemCount} item${f.itemCount === 1 ? "" : "s"}`
                          : "Empty"}
                      </span>
                    </span>
                  </span>
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground whitespace-nowrap",
                  )}
                >
                  Folder
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground text-right whitespace-nowrap tabular-nums",
                  )}
                >
                  {f.sizeBytes ? formatBytes(f.sizeBytes) : "—"}
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground whitespace-nowrap",
                  )}
                >
                  {f.modifiedAt ? dateLabel(f.modifiedAt) : "—"}
                </td>
                <td className={cn(cell, "text-muted-foreground max-w-0")}>
                  <span
                    className="block truncate"
                    title={f.createdByEmail ?? ""}
                  >
                    {f.createdByEmail ?? "—"}
                  </span>
                </td>
              </tr>
            );
          })}

          {p.files.map((f) => {
            const ref: ItemRef = { kind: "file", id: f.id };
            const selected = p.isSelected(ref);
            const { Icon, className } = iconForFile(f.contentType, f.ext);
            return (
              <tr
                key={f.id}
                {...p.dragProps(ref)}
                onClick={(e) =>
                  p.onItemClick(ref, {
                    shift: e.shiftKey,
                    ctrl: e.ctrlKey || e.metaKey,
                  })
                }
                onDoubleClick={() => p.onOpenFile(f)}
                onContextMenu={(e) => p.onContextMenu(ref, e)}
                className={cn(
                  "hover:bg-accent/50 cursor-default border-b",
                  selected && "bg-accent",
                )}
              >
                <td className={cell}>
                  <Checkbox
                    checked={selected}
                    aria-label={`Select ${f.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onItemClick(ref, { ctrl: true });
                    }}
                  />
                </td>
                <td className={cell}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", className)} />
                    <button
                      type="button"
                      className="truncate hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        p.onOpenFile(f);
                      }}
                    >
                      {f.title}
                    </button>
                  </span>
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground whitespace-nowrap",
                  )}
                >
                  {typeLabel(f.contentType, f.ext)}
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground text-right whitespace-nowrap tabular-nums",
                  )}
                >
                  {formatBytes(f.size)}
                </td>
                <td
                  className={cn(
                    cell,
                    "text-muted-foreground whitespace-nowrap",
                  )}
                >
                  {dateLabel(f.updatedAt)}
                </td>
                <td className={cn(cell, "text-muted-foreground max-w-0")}>
                  <span
                    className="block truncate"
                    title={f.uploadedByEmail ?? ""}
                  >
                    {f.uploadedByEmail ?? "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tile view: bigger targets, thumbnails for images. */
export function ItemGrid(p: ItemViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-1">
      {p.folders.map((f) => {
        const ref: ItemRef = { kind: "folder", id: f.id };
        const selected = p.isSelected(ref);
        return (
          <button
            key={f.id}
            type="button"
            {...p.dragProps(ref)}
            {...p.dropProps(f.id)}
            onClick={(e) =>
              p.onItemClick(ref, {
                shift: e.shiftKey,
                ctrl: e.ctrlKey || e.metaKey,
              })
            }
            onDoubleClick={() => p.onOpenFolder(f.id)}
            onContextMenu={(e) => p.onContextMenu(ref, e)}
            className={cn(
              "hover:bg-accent/50 flex flex-col items-center gap-2 rounded-lg p-3 text-center",
              selected && "bg-accent",
              p.dropTargetId === f.id && "ring-primary bg-primary/5 ring-2",
            )}
          >
            <FolderIcon className="text-primary size-10" />
            <span className="w-full truncate font-medium">{f.name}</span>
          </button>
        );
      })}

      {p.files.map((f) => {
        const ref: ItemRef = { kind: "file", id: f.id };
        const selected = p.isSelected(ref);
        const { Icon, className } = iconForFile(f.contentType, f.ext);
        return (
          <button
            key={f.id}
            type="button"
            {...p.dragProps(ref)}
            onClick={(e) =>
              p.onItemClick(ref, {
                shift: e.shiftKey,
                ctrl: e.ctrlKey || e.metaKey,
              })
            }
            onDoubleClick={() => p.onOpenFile(f)}
            onContextMenu={(e) => p.onContextMenu(ref, e)}
            className={cn(
              "hover:bg-accent/50 flex flex-col items-center gap-2 rounded-lg p-3 text-center",
              selected && "bg-accent",
            )}
          >
            <Icon className={cn("size-10", className)} />
            <span className="w-full truncate">{f.title}</span>
            <span className="text-muted-foreground text-admin-2xs">
              {formatBytes(f.size)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sidebar tree. Every node is also a drop target for a move. */
export function FolderTree({
  tree,
  currentId,
  onOpen,
  dropProps,
  dropTargetId,
}: {
  tree: FolderNode[];
  currentId: string | null;
  onOpen: (id: string | null) => void;
  dropProps: (folderId: string | null) => React.HTMLAttributes<HTMLElement>;
  dropTargetId: string | null;
}) {
  const byParent = new Map<string | null, FolderNode[]>();
  for (const f of tree) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }

  const render = (parentId: string | null, depth: number): React.ReactNode =>
    (byParent.get(parentId) ?? []).map((f) => (
      <div key={f.id}>
        <button
          type="button"
          {...dropProps(f.id)}
          onClick={() => onOpen(f.id)}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          className={cn(
            "hover:bg-accent flex w-full items-center gap-1.5 rounded py-1.5 pr-2 text-left",
            currentId === f.id && "bg-accent font-medium",
            dropTargetId === f.id && "ring-primary bg-primary/5 ring-2",
          )}
        >
          <FolderIcon className="text-primary size-4 shrink-0" />
          <span className="truncate">{f.name}</span>
        </button>
        {render(f.id, depth + 1)}
      </div>
    ));

  return (
    <nav className="flex flex-col gap-px">
      <button
        type="button"
        {...dropProps(null)}
        onClick={() => onOpen(null)}
        className={cn(
          "hover:bg-accent flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left",
          currentId === null && "bg-accent font-medium",
          dropTargetId === "root" && "ring-primary bg-primary/5 ring-2",
        )}
      >
        <FolderIcon className="text-primary size-4 shrink-0" />
        Vault
      </button>
      {render(null, 1)}
    </nav>
  );
}
