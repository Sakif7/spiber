import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  File as FileIcon,
  Folder,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon and tint per file type, so a folder of mixed documents is scannable at a
 * glance rather than a column of identical grey sheets.
 */
export function iconForFile(
  mime: string,
  ext: string | null,
): { Icon: LucideIcon; className: string } {
  const e = (ext ?? "").toLowerCase();

  if (mime === "application/pdf" || e === "pdf") {
    return { Icon: FileType, className: "text-red-600 dark:text-red-400" };
  }
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "avif", "gif"].includes(e)
  ) {
    return {
      Icon: FileImage,
      className: "text-violet-600 dark:text-violet-400",
    };
  }
  if (
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    ["xlsx", "xls", "csv"].includes(e)
  ) {
    return {
      Icon: FileSpreadsheet,
      className: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (
    mime.includes("presentationml") ||
    mime === "application/vnd.ms-powerpoint" ||
    ["pptx", "ppt"].includes(e)
  ) {
    return {
      Icon: Presentation,
      className: "text-orange-600 dark:text-orange-400",
    };
  }
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    ["docx", "doc"].includes(e)
  ) {
    return { Icon: FileText, className: "text-blue-600 dark:text-blue-400" };
  }
  if (mime.includes("zip") || ["zip", "rar", "7z"].includes(e)) {
    return {
      Icon: FileArchive,
      className: "text-amber-600 dark:text-amber-400",
    };
  }
  if (mime.startsWith("text/") || ["txt", "md", "log"].includes(e)) {
    return { Icon: FileText, className: "text-slate-500 dark:text-slate-400" };
  }
  return { Icon: FileIcon, className: "text-muted-foreground" };
}

export const folderIcon = {
  Icon: Folder,
  className: "text-primary",
};
