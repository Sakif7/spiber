"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Download,
  Eye,
  FileLock2,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { formatApiError } from "@/lib/http/form-error";

export type VaultDocRow = {
  id: string;
  title: string;
  originalFilename: string;
  contentType: string;
  size: number;
  folder: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mime: string): string {
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
  if (mime === "text/csv") return "CSV";
  if (mime === "text/plain") return "Text";
  if (mime.includes("zip")) return "ZIP";
  return mime;
}

/**
 * The company vault UI (super-admin only). Files upload through
 * /api/admin/company/documents (encrypted at rest) and are viewed/downloaded
 * exclusively via the audited /api/media/company-document/[id] route.
 */
export function DocumentsManager({
  rows,
  folders,
}: {
  rows: VaultDocRow[];
  folders: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<VaultDocRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [deleting, setDeleting] = useState<VaultDocRow | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (title.trim()) fd.set("title", title.trim());
      if (folder.trim()) fd.set("folder", folder.trim());
      const res = await fetch("/api/admin/company/documents", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "upload_failed"));
        return;
      }
      toast.success("Document stored in the vault (encrypted).");
      setTitle("");
      setFolder("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/documents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || editing.title,
          folder: editFolder.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "save_failed"));
        return;
      }
      toast.success("Document updated.");
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/documents/${deleting.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "delete_failed"));
        return;
      }
      toast.success("Document deleted.");
      setDeleting(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<VaultDocRow>[] = [
    {
      key: "title",
      header: "Document",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <FileLock2
            size={15}
            aria-hidden
            className="text-primary shrink-0 opacity-70"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.title}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {r.originalFilename}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "folder",
      header: "Folder",
      mobile: "meta",
      cell: (r) =>
        r.folder ? (
          <span>{r.folder}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "type",
      header: "Type",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">
          {typeLabel(r.contentType)}
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">{formatSize(r.size)}</span>
      ),
    },
    {
      key: "by",
      header: "Uploaded by",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.uploadedByEmail ?? "—"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) => (
        <span className="flex items-center justify-end gap-0.5">
          <Button asChild variant="ghost" size="icon" className="size-8">
            {/* Gated route: view opens inline (audited server-side). */}
            <a
              href={`/api/media/company-document/${r.id}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${r.title}`}
            >
              <Eye className="size-4" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-8">
            <a
              href={`/api/media/company-document/${r.id}?download=1`}
              aria-label={`Download ${r.title}`}
            >
              <Download className="size-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Rename ${r.title}`}
            onClick={() => {
              setEditing(r);
              setEditTitle(r.title);
              setEditFolder(r.folder ?? "");
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive size-8"
            aria-label={`Delete ${r.title}`}
            onClick={() => setDeleting(r)}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <form
        onSubmit={upload}
        className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)]"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="vault-file">File</Label>
            <Input id="vault-file" ref={fileRef} type="file" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vault-title">Title (optional)</Label>
            <Input
              id="vault-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the filename"
              maxLength={160}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vault-folder">Folder (optional)</Label>
            <Input
              id="vault-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="e.g. Licenses"
              maxLength={80}
              list="vault-folders"
            />
            <datalist id="vault-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload
          </Button>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Files are encrypted (AES-256-GCM) before they reach storage and are
          only readable through this page. Every view and download is recorded
          in the audit log. Max 50MB — PDF, images, Office documents, CSV, text,
          ZIP.
        </p>
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="The vault is empty — upload the first document above."
        minWidth={880}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vault-edit-title">Title</Label>
              <Input
                id="vault-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vault-edit-folder">Folder</Label>
              <Input
                id="vault-edit-folder"
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                placeholder="Leave empty for no folder"
                maxLength={80}
                list="vault-folders"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            The document will be removed from the vault (soft-deleted with
            history, per company policy).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
