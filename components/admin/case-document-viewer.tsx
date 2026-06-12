import { FileText } from "lucide-react";

/**
 * Lists a case's medical documents. Each row links to the AUTH-GATED, AUDITED
 * /api/media/case route (admin / assigned case manager only) — the raw storage
 * key never reaches the client, and opening a document is logged server-side.
 */
export function CaseDocumentViewer({
  caseId,
  documents,
}: {
  caseId: string;
  documents: { name: string }[];
}) {
  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground m-0 text-sm">
        No documents uploaded.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      {documents.map((d, i) => (
        <a
          key={i}
          href={`/api/media/case/${caseId}/${i}`}
          target="_blank"
          rel="noreferrer"
          className="border-border text-primary hover:bg-muted flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm no-underline"
        >
          <FileText size={16} aria-hidden />
          <span className="break-all">{d.name}</span>
        </a>
      ))}
      <p className="text-muted-foreground m-0 text-xs">
        Patient health data — every view is logged.
      </p>
    </div>
  );
}
