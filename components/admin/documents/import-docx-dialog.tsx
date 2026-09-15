"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";

/** A new document from a Word file, then straight into the editor. */
export function ImportDocxButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>("notice");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.docx$/i, ""));
    setError(null);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("type", type);
      form.set("title", title.trim());
      form.set("language", "en");
      const res = await fetch("/api/admin/company/documents/import", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = json?.error?.code as string | undefined;
        setError(
          code === "not_docx" || code === "unreadable"
            ? "That file is not a Word (.docx) document the importer can read."
            : code === "too_large"
              ? "The file is larger than 15 MB."
              : code === "too_big_for_a_document"
                ? "The pictures inside make it too large for one document — shrink them first."
                : formatApiError(json, "Could not import the file."),
        );
        return;
      }
      const warnings = (json?.data?.warnings ?? []) as string[];
      toast.success(
        warnings.length
          ? `Imported; ${warnings.length} thing${warnings.length === 1 ? "" : "s"} could not be carried over.`
          : "Imported.",
      );
      setOpen(false);
      router.push(`/admin/company/documents/${json.data.id}/edit`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FileUp className="size-4" aria-hidden />
        Import Word file
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import a Word file</DialogTitle>
            <DialogDescription>
              Headings, lists, tables, pictures and text styling come across;
              anything else Word does is left out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">File (.docx)</Label>
              <Input
                id="import-file"
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <SelectField
                value={type}
                onChange={(v) => setType(v as DocumentType)}
                options={DOCUMENT_TYPES.map((t) => ({
                  value: t,
                  label: DOCUMENT_TYPE_LABEL[t],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-title">Title</Label>
              <Input
                id="import-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !file || !title.trim()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Import and open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
