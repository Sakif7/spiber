"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FolderIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  fileHref,
  isPreviewable,
  type FileNode,
  type FolderNode,
} from "./types";

/** Create a folder, or rename a folder or file. One dialog, one text field. */
export function NameDialog({
  open,
  title,
  label,
  initial,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
  allowEmpty = false,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  /** For an optional note: confirm with nothing typed. */
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState(initial ?? "");
  const ready = allowEmpty || Boolean(value.trim());

  // Reset when the dialog is opened for a different item.
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) setValue(initial ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onConfirm(value.trim());
          }}
        >
          <Label htmlFor="fm-name">{label}</Label>
          <Input
            id="fm-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={200}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => ready && onConfirm(value.trim())}
            disabled={busy || !ready}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Destination picker for move and copy. The tree is rendered inline rather than
 * as a dropdown so the shape of the vault is visible while choosing.
 */
export function FolderPickerDialog({
  open,
  title,
  confirmLabel,
  tree,
  /** Folders that cannot be chosen (the ones being moved, and their subtrees). */
  disabledIds,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  tree: FolderNode[];
  disabledIds: Set<string>;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (targetId: string | null) => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) setTarget(null);
  }

  const byParent = new Map<string | null, FolderNode[]>();
  for (const f of tree) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }

  const render = (parentId: string | null, depth: number): React.ReactNode =>
    (byParent.get(parentId) ?? []).map((f) => {
      const blocked = disabledIds.has(f.id);
      return (
        <div key={f.id}>
          <button
            type="button"
            disabled={blocked}
            onClick={() => setTarget(f.id)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left",
              blocked
                ? "text-muted-foreground/50 cursor-not-allowed"
                : "hover:bg-accent",
              target === f.id && "bg-accent font-medium",
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <FolderIcon className="text-primary size-4 shrink-0" />
            <span className="truncate">{f.name}</span>
          </button>
          {render(f.id, depth + 1)}
        </div>
      );
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Choose a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded border p-1">
          <button
            type="button"
            onClick={() => setTarget(null)}
            className={cn(
              "hover:bg-accent flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left",
              target === null && "bg-accent font-medium",
            )}
          >
            <ChevronRight className="size-4 shrink-0 opacity-50" />
            Vault (root)
          </button>
          {render(null, 1)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(target)} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{body}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline preview. Images and PDFs render through the same audited, gated route
 * the download uses — the file is never exposed by any other URL.
 */
export function PreviewDialog({
  file,
  onClose,
  onPrev,
  onNext,
}: {
  file: FileNode | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onPrev, onNext]);

  const previewable = file ? isPreviewable(file.contentType) : false;

  return (
    <Dialog open={file !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-4xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.title}</DialogTitle>
        </DialogHeader>
        {file && previewable ? (
          file.contentType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- gated, non-optimisable route
            <img
              src={fileHref(file.id)}
              alt={file.title}
              className="max-h-[70vh] w-full rounded object-contain"
            />
          ) : (
            <iframe
              src={fileHref(file.id)}
              title={file.title}
              className="h-[70vh] w-full rounded border"
            />
          )
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No preview for this file type. Download it to open.
          </p>
        )}
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            {onPrev && (
              <Button variant="outline" size="sm" onClick={onPrev}>
                Previous
              </Button>
            )}
            {onNext && (
              <Button variant="outline" size="sm" onClick={onNext}>
                Next
              </Button>
            )}
          </div>
          {file && (
            <Button asChild size="sm">
              <a href={fileHref(file.id, true)}>Download</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
