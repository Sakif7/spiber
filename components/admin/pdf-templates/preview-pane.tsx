"use client";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import type { PdfPreview } from "./use-pdf-preview";

/**
 * The live preview pane: the rendered document in the browser's own PDF
 * viewer, with a badge saying whether it is behind the edits. The render
 * itself is owned by the editor (`usePdfPreview`), because the stamp pad
 * draws from the same bytes.
 */
export function PreviewPane({ preview }: { preview: PdfPreview }) {
  const status = preview.error
    ? { tone: "danger" as const, label: "Error" }
    : preview.stale || !preview.url
      ? { tone: "warning" as const, label: "Rendering…" }
      : { tone: "success" as const, label: "Up to date" };

  return (
    <Card className="sticky top-4 gap-0 p-0 lg:h-[calc(100vh-9rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">Preview</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Sample data — not a real order.
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {preview.error && (
        <p role="alert" className="text-destructive border-b px-4 py-2 text-sm">
          {preview.error}
        </p>
      )}
      <div className="bg-muted/40 min-h-[60vh] flex-1 lg:min-h-0">
        {preview.url ? (
          <iframe
            key={preview.url}
            title="PDF preview"
            src={`${preview.url}#toolbar=0&view=FitH`}
            className="h-full min-h-[60vh] w-full lg:min-h-0"
          />
        ) : (
          <div className="text-muted-foreground flex h-full min-h-[60vh] items-center justify-center text-sm lg:min-h-0">
            {preview.error
              ? "Nothing to show yet."
              : "Rendering the first preview…"}
          </div>
        )}
      </div>
    </Card>
  );
}
