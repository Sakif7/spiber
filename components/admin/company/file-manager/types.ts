import type { FolderNode, FileNode } from "@/lib/services/company-fs.service";

export type { FolderNode, FileNode };

export type Usage = {
  usedBytes: number;
  trashBytes: number;
  fileCount: number;
  quotaBytes: number;
};

export type ListPayload = {
  folder: FolderNode | null;
  breadcrumb: FolderNode[];
  folders: FolderNode[];
  files: FileNode[];
  usage: Usage;
};

/** A selected thing is addressed by kind + id; the two id spaces are separate. */
export type ItemKind = "folder" | "file";
export type ItemRef = { kind: ItemKind; id: string };

export const refKey = (r: ItemRef) => `${r.kind}:${r.id}`;

/** What the drag payload carries between rows, tree nodes and breadcrumbs. */
export const DND_MIME = "application/x-vault-items";

export type SortKey = "name" | "size" | "type" | "modified";
export type SortDir = "asc" | "desc";
export type ViewMode = "list" | "grid";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function typeLabel(mime: string, ext: string | null): string {
  if (ext) return ext.toUpperCase();
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.slice(6).toUpperCase();
  if (mime.includes("wordprocessingml") || mime === "application/msword")
    return "Word";
  if (mime.includes("spreadsheetml") || mime === "application/vnd.ms-excel")
    return "Excel";
  if (
    mime.includes("presentationml") ||
    mime === "application/vnd.ms-powerpoint"
  )
    return "PowerPoint";
  if (mime.includes("zip")) return "ZIP";
  if (mime === "text/csv") return "CSV";
  if (mime === "text/plain") return "Text";
  return mime;
}

/** Files the preview dialog can show inline rather than only download. */
export function isPreviewable(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

export const fileHref = (id: string, download = false) =>
  `/api/media/company-document/${id}${download ? "?download=1" : ""}`;
